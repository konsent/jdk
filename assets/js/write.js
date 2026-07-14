import { db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import {
  collection, addDoc, getDoc, getDocs, query, where, updateDoc, serverTimestamp, Timestamp,
  doc, setDoc, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ROOT_UID = "GNdKNf2KYwgBqOjrX9OmPJO5oEv1";
const FUNCTIONS_BASE = "https://us-central1-jdk-member-board.cloudfunctions.net";
let selectedGames = [];

const params = new URLSearchParams(location.search);
const editId = params.get("edit"); // 수정 모드: /write/?edit=postId

let currentUser = null;
let currentUserData = null;

requireApproved(async (user, userData) => {
  currentUser = user;
  currentUserData = userData;

  if (userData.isAdmin) {
    document.getElementById("section-type").style.display = "block";
  }

  if (user.uid === ROOT_UID) {
    await loadAuthorOptions();
    document.getElementById("section-author").style.display = "block";
  }

  function updateEventFields() {
    const type = document.getElementById("select-type").value;
    document.getElementById("section-event-fields").style.display =
      type === "event" ? "block" : "none";
  }

  document.getElementById("select-type").addEventListener("change", updateEventFields);
  updateEventFields();
  setupGameSearch();

  if (editId) {
    await loadForEdit(userData);
  }
});

async function loadAuthorOptions() {
  const select = document.getElementById("select-author");
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
  snap.docs
    .filter(d => d.id !== ROOT_UID)
    .forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.data().nickname || d.id;
      select.appendChild(opt);
    });
}

async function loadForEdit(userData) {
  const snap = await getDoc(doc(db, "posts", editId));
  if (!snap.exists()) { showError("게시글을 찾을 수 없습니다."); return; }

  const post = snap.data();
  const canEdit = currentUser.uid === post.authorUid || userData.isAdmin;
  if (!canEdit) { showError("수정 권한이 없습니다."); return; }

  // UI 수정 모드로 전환
  document.getElementById("page-title").textContent = "글 수정";
  document.getElementById("page-subtitle").textContent = "게시글을 수정합니다";
  document.getElementById("btn-submit").textContent = "수정 완료";
  document.getElementById("btn-cancel").href = `/post/?id=${editId}`;

  // 기존 값 채우기
  document.getElementById("input-title").value = post.title || "";
  document.getElementById("input-content").value = post.content || "";

  if (post.type === "notice" && userData.isAdmin) {
    document.getElementById("select-type").value = "notice";
    document.getElementById("section-event-fields").style.display = "none";
  }

  if (post.type === "event" && post.eventDate) {
    const d = post.eventDate.toDate();
    // 날짜
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    document.getElementById("input-date").value = `${yyyy}-${mm}-${dd}`;
    // 시간 (분이 있으면 채우기)
    const hh = d.getHours();
    const min = d.getMinutes();
    if (hh !== 0 || min !== 0) {
      document.getElementById("input-time-hour").value = String(hh).padStart(2, "0");
      document.getElementById("input-time-minute").value = String(min).padStart(2, "0");
    }
    document.getElementById("input-max").value = post.maxAttendees || 5;
    selectedGames = post.games || [];
    renderSelectedGames();
  }
}

document.getElementById("form-write").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("input-title").value.trim();
  const content = document.getElementById("input-content").value.trim();
  const type = currentUserData?.isAdmin
    ? document.getElementById("select-type").value
    : "event";

  if (!title || !content) { showError("제목과 내용을 입력해주세요."); return; }

  // 날짜+시간 파싱
  let eventDate = null;
  if (type === "event") {
    const dateStr = document.getElementById("input-date").value;
    const hourStr = document.getElementById("input-time-hour").value;
    const minuteStr = document.getElementById("input-time-minute").value;
    if (!dateStr) { showError("일정 날짜를 선택해주세요."); return; }
    const timeStr = (hourStr && minuteStr) ? `${hourStr}:${minuteStr}` : "";
    const combined = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00`;
    eventDate = Timestamp.fromDate(new Date(combined));
  }

  try {
    if (editId) {
      // 수정 모드
      const updates = { title, content, updatedAt: serverTimestamp() };
      if (type === "event") {
        updates.eventDate = eventDate;
        updates.maxAttendees = parseInt(document.getElementById("input-max").value, 10);
        updates.games = selectedGames;
      }
      await updateDoc(doc(db, "posts", editId), updates);
      location.href = `/post/?id=${editId}`;
    } else {
      // 신규 등록
      const assignedUid = currentUser.uid === ROOT_UID
        ? (document.getElementById("select-author")?.value || currentUser.uid)
        : currentUser.uid;

      const postData = {
        type, title, content,
        authorUid: assignedUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (type === "event") {
        postData.eventDate = eventDate;
        postData.maxAttendees = parseInt(document.getElementById("input-max").value, 10);
        postData.attendees = [assignedUid];
        postData.games = selectedGames;
      }
      const ref = await addDoc(collection(db, "posts"), postData);

      if (type === "event") {
        const assignedNickname = assignedUid === currentUser.uid
          ? currentUserData.nickname
          : document.getElementById("select-author").selectedOptions[0].textContent;
        try {
          await setDoc(doc(db, "stats", "global"), {
            updatedAt: serverTimestamp(),
            [`members.${assignedUid}.nickname`]: assignedNickname,
            [`members.${assignedUid}.postCount`]: increment(1),
            [`members.${assignedUid}.attendCount`]: increment(0)
          }, { merge: true });
        } catch (e) {
          console.error("stats update failed", e);
        }
      }

      location.href = `/post/?id=${ref.id}`;
    }
  } catch (err) {
    showError(editId ? "수정 중 오류가 발생했습니다." : "등록 중 오류가 발생했습니다.");
  }
});

function renderSelectedGames() {
  const el = document.getElementById("selected-games");
  el.innerHTML = selectedGames.map((g, i) => `
    <span class="game-tag">
      ${g.thumbnail ? `<img src="${escapeGameText(g.thumbnail)}" alt="">` : ""}
      ${escapeGameText(g.name)}${g.yearPublished ? ` (${g.yearPublished})` : ""}
      <button type="button" data-idx="${i}" class="game-tag-remove">×</button>
    </span>
  `).join("");
  el.querySelectorAll(".game-tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedGames.splice(Number(btn.dataset.idx), 1);
      renderSelectedGames();
    });
  });
}

function escapeGameText(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML.replace(/"/g, "&quot;");
}

function renderCandidates(candidates) {
  const el = document.getElementById("game-candidates");
  if (!candidates.length) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.innerHTML = candidates.map((c) =>
    `<div class="game-candidate" data-id="${escapeGameText(c.bggId)}" data-name="${escapeGameText(c.name)}">
      ${escapeGameText(c.name)}${c.yearPublished ? ` (${c.yearPublished})` : ""}
    </div>`
  ).join("");
  el.style.display = "block";
  el.querySelectorAll(".game-candidate").forEach((row) => {
    row.addEventListener("click", async () => {
      const bggId = row.dataset.id;
      el.style.display = "none";
      document.getElementById("input-game-search").value = "";
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/getBoardGameDetail?id=${encodeURIComponent(bggId)}`);
        const detail = await res.json();
        if (detail) {
          selectedGames.push(detail);
          renderSelectedGames();
        }
      } catch (e) {
        console.error("게임 상세 조회 실패:", e);
      }
    });
  });
}

let searchDebounceTimer = null;
function setupGameSearch() {
  const input = document.getElementById("input-game-search");
  input.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    const q = input.value.trim();
    if (!q) { renderCandidates([]); return; }
    searchDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/searchBoardGame?q=${encodeURIComponent(q)}`);
        renderCandidates(await res.json());
      } catch (e) {
        console.error("게임 검색 실패:", e);
        renderCandidates([]);
      }
    }, 300);
  });
}

function showError(msg) {
  const el = document.getElementById("msg-error");
  el.textContent = msg;
  el.style.display = "block";
}
