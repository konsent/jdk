import { db, functions } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import { showError } from "./utils.js";
import { listMyParties } from "./party.js";
import { normalizeMembers } from "./party-logic.js";
import {
  collection, addDoc, getDoc, getDocs, query, where, updateDoc, serverTimestamp, Timestamp,
  doc, setDoc, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// onCall 은 SDK 가 Auth 토큰을 자동으로 실어 보낸다.
// (예전 fetch 방식은 토큰이 없어 누구나 부를 수 있었다)
const callSearchBoardGame = httpsCallable(functions, "searchBoardGame");
const callGetBoardGameDetail = httpsCallable(functions, "getBoardGameDetail");
let selectedGames = [];
let selectedPartyAttendees = null;

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

  // 예전에는 특정 UID 를 소스에 박아뒀다. 공개 저장소라 그대로 노출됐고,
  // 계정이 바뀌면 코드를 고쳐야 했다 — users 문서의 플래그로 옮겼다.
  if (userData.canPostAsOther) {
    await loadAuthorOptions(user.uid);
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

  if (!editId) {
    await setupPartySelect(user);
  }

  if (editId) {
    await loadForEdit(userData);
  }
});

async function loadAuthorOptions(selfUid) {
  const select = document.getElementById("select-author");
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
  snap.docs
    .filter(d => d.id !== selfUid)
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

let submitting = false;

document.getElementById("form-write").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitting) return; // 중복 클릭 방지
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
    const parsed = new Date(combined);
    // 브라우저/입력기에 따라 형식이 어긋나면 Invalid Date 가 되고,
    // 그대로 Timestamp.fromDate 에 넣으면 안내 없이 예외로 죽는다.
    if (Number.isNaN(parsed.getTime())) {
      showError("일정 날짜/시간 형식이 올바르지 않습니다.");
      return;
    }
    eventDate = Timestamp.fromDate(parsed);
  }

  const submitBtn = document.getElementById("btn-submit");
  submitting = true;
  submitBtn.disabled = true;

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
      const assignedUid = currentUserData?.canPostAsOther
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
        postData.attendees = selectedPartyAttendees
          ? normalizeMembers(assignedUid, selectedPartyAttendees)
          : [assignedUid];
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
    console.error("게시글 저장 실패", err);
    showError(editId ? "수정 중 오류가 발생했습니다." : "등록 중 오류가 발생했습니다.");
    submitting = false;
    submitBtn.disabled = false;
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

const THUMBNAIL_PREVIEW_COUNT = 5;
const THUMBNAIL_FETCH_DELAY = 400;
const candidateDetailCache = new Map();
let thumbnailFetchTimer = null;

async function fetchGameDetail(bggId) {
  if (candidateDetailCache.has(bggId)) return candidateDetailCache.get(bggId);
  const { data: detail } = await callGetBoardGameDetail({ id: bggId });
  if (detail) candidateDetailCache.set(bggId, detail);
  return detail;
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
      <span class="game-candidate-thumb"></span>
      <span>${escapeGameText(c.name)}${c.yearPublished ? ` (${c.yearPublished})` : ""}</span>
    </div>`
  ).join("");
  el.style.display = "block";
  el.querySelectorAll(".game-candidate").forEach((row) => {
    row.addEventListener("click", async () => {
      const bggId = row.dataset.id;
      el.style.display = "none";
      document.getElementById("input-game-search").value = "";
      try {
        const detail = await fetchGameDetail(bggId);
        if (detail) {
          selectedGames.push(detail);
          renderSelectedGames();
        }
      } catch (e) {
        console.error("게임 상세 조회 실패:", e);
      }
    });
  });

  clearTimeout(thumbnailFetchTimer);
  thumbnailFetchTimer = setTimeout(() => {
    candidates.slice(0, THUMBNAIL_PREVIEW_COUNT).forEach((c) => {
      fetchGameDetail(c.bggId).then((detail) => {
        if (!detail?.thumbnail) return;
        const thumb = el.querySelector(`.game-candidate[data-id="${CSS.escape(c.bggId)}"] .game-candidate-thumb`);
        if (thumb && !thumb.querySelector("img")) {
          thumb.innerHTML = `<img src="${escapeGameText(detail.thumbnail)}" alt="">`;
        }
      }).catch(() => {});
    });
  }, THUMBNAIL_FETCH_DELAY);
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
        const { data } = await callSearchBoardGame({ q });
        renderCandidates(data);
      } catch (e) {
        console.error("게임 검색 실패:", e);
        renderCandidates([]);
      }
    }, 300);
  });
}

let myParties = [];

async function setupPartySelect(user) {
  try {
    myParties = await listMyParties(user.uid);
  } catch (e) {
    console.error("파티 목록 조회 실패", e);
    return;
  }
  if (!myParties.length) return;

  const select = document.getElementById("select-party");
  myParties.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.memberUids.length}명)`;
    select.appendChild(opt);
  });
  document.getElementById("section-party").style.display = "block";

  select.addEventListener("change", () => {
    const party = myParties.find((p) => p.id === select.value);
    if (!party) return;
    selectedPartyAttendees = party.memberUids;
    document.getElementById("input-max").value = party.memberUids.length;
  });
}

