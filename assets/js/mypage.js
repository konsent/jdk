import { auth, db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import { deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { computeAverages, computeKongzTemp, tempToColor } from "./rating-logic.js";
import { listMyParties, createParty, updateParty, deleteParty, listApprovedUsers } from "./party.js";
import { filterByNickname } from "./party-logic.js";

let currentUser = null;

requireApproved(async (user, userData) => {
  currentUser = user;

  document.getElementById("info-loading").style.display = "none";
  document.getElementById("info-content").style.display = "block";
  document.getElementById("info-nickname").textContent = userData.nickname;
  document.getElementById("info-email").textContent = user.email || "-";
  document.getElementById("info-status").textContent = "승인된 회원";

  // 태그 렌더링
  const tags = [];
  if (userData.isAdmin) {
    tags.push(`<span style="font-size:0.7rem;font-weight:600;background:#1a1a1a;color:#fff;border-radius:4px;padding:2px 8px">관리자</span>`);
  }
  if (userData.annualMember) {
    tags.push(`<span style="font-size:0.7rem;font-weight:600;background:#2e7d32;color:#fff;border-radius:4px;padding:2px 8px">연회원</span>`);
    const img = document.getElementById("info-honor-img");
    img.src = `/assets/honor/${encodeURIComponent(userData.nickname)}.jpg`;
    img.onerror = () => { img.style.display = "none"; };
    img.style.display = "block";
  }
  document.getElementById("info-tags").innerHTML = tags.join(" ");

  try {
    const statsSnap = await getDoc(doc(db, "stats", "global"));
    const myStats = statsSnap.data()?.members?.[user.uid];
    const { temp } = computeKongzTemp(myStats);
    const badge = document.getElementById("info-temp-badge");
    badge.style.display = "flex";
    badge.style.color = tempToColor(temp);
    badge.textContent = `${temp}°C`;

    const averages = computeAverages(myStats);
    document.getElementById("info-rating").innerHTML = averages.count === 0
      ? `<div style="font-size:0.86rem;color:var(--text-muted)">아직 받은 평가가 없습니다.</div>`
      : `<div style="font-size:0.92rem;color:var(--text-secondary)">매너 ${averages.manner} · 실력 ${averages.skill} · 또 놀고 싶어요 ${averages.again} <span style="color:var(--text-muted);font-size:0.78rem">(${averages.count}회 평가받음)</span></div>`;
  } catch (e) {
    console.error("rating stats load failed", e);
  }

  await setupParties(user);

  document.getElementById("btn-withdraw").addEventListener("click", () => {
    document.getElementById("confirm-modal").style.display = "flex";
  });

  document.getElementById("modal-cancel").addEventListener("click", () => {
    document.getElementById("confirm-modal").style.display = "none";
  });

  document.getElementById("confirm-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById("confirm-modal").style.display = "none";
    }
  });

  document.getElementById("modal-confirm").addEventListener("click", async () => {
    document.getElementById("confirm-modal").style.display = "none";
    document.getElementById("modal-confirm").disabled = true;
    await withdraw(user);
  });
});

async function withdraw(user) {
  try {
    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);
    location.href = "/";
  } catch (err) {
    if (err.code === "auth/requires-recent-login") {
      showError("보안을 위해 로그아웃 후 다시 로그인하고 탈퇴를 진행해 주세요.");
    } else {
      showError("탈퇴 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  }
}

function showError(msg) {
  const el = document.getElementById("msg-error");
  el.textContent = msg;
  el.style.display = "block";
}

let allApprovedUsers = [];
let partyDraftMembers = []; // {uid, nickname}[], 편집 중인 파티의 멤버(본인 제외 표시용, 본인은 항상 포함됨을 별도 안내)
let editingPartyId = null;

async function setupParties(user) {
  allApprovedUsers = await listApprovedUsers().catch((e) => {
    console.error("승인된 유저 목록 조회 실패", e);
    return [];
  });

  await renderPartyList(user);

  document.getElementById("btn-party-new").addEventListener("click", () => openPartyForm(user, null));
  document.getElementById("btn-party-cancel").addEventListener("click", closePartyForm);
  document.getElementById("btn-party-save").addEventListener("click", () => savePartyForm(user));

  const searchInput = document.getElementById("party-member-search");
  searchInput.addEventListener("input", () => {
    const matches = filterByNickname(
      allApprovedUsers.filter((u) => u.uid !== user.uid && !partyDraftMembers.some((m) => m.uid === u.uid)),
      searchInput.value
    );
    renderPartyMemberCandidates(matches, user);
  });
}

async function renderPartyList(user) {
  const listEl = document.getElementById("party-list");
  let parties = [];
  try {
    parties = await listMyParties(user.uid);
  } catch (e) {
    console.error("파티 목록 조회 실패", e);
    listEl.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted)">파티 목록을 불러오지 못했습니다.</div>`;
    return;
  }

  if (!parties.length) {
    listEl.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted)">아직 만든 파티가 없습니다.</div>`;
    return;
  }

  listEl.innerHTML = parties.map((p) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--card-border)" data-party-id="${escapePartyText(p.id)}">
      <div>
        <div style="font-weight:600;font-size:0.9rem">${escapePartyText(p.name)}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${p.memberUids.map((uid) => escapePartyText(nicknameOf(uid))).join(", ")}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button type="button" class="party-edit-btn" data-id="${escapePartyText(p.id)}" style="border:1px solid var(--card-border);background:transparent;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:0.8rem">수정</button>
        <button type="button" class="party-delete-btn" data-id="${escapePartyText(p.id)}" style="border:1px solid var(--danger);color:var(--danger);background:transparent;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:0.8rem">삭제</button>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".party-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const party = parties.find((p) => p.id === btn.dataset.id);
      openPartyForm(user, party);
    });
  });
  listEl.querySelectorAll(".party-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await deleteParty(btn.dataset.id);
        await renderPartyList(user);
      } catch (e) {
        console.error("파티 삭제 실패", e);
        showError("파티 삭제 중 오류가 발생했습니다.");
      }
    });
  });
}

function nicknameOf(uid) {
  return allApprovedUsers.find((u) => u.uid === uid)?.nickname || uid;
}

function openPartyForm(user, party) {
  editingPartyId = party ? party.id : null;
  document.getElementById("party-form-id").value = editingPartyId || "";
  document.getElementById("party-form-name").value = party ? party.name : "";
  partyDraftMembers = party
    ? party.memberUids.filter((uid) => uid !== user.uid).map((uid) => ({ uid, nickname: nicknameOf(uid) }))
    : [];
  document.getElementById("party-member-search").value = "";
  renderPartyMemberCandidates([], user);
  renderPartyDraftMembers(user);
  document.getElementById("party-form").style.display = "block";
}

function closePartyForm() {
  document.getElementById("party-form").style.display = "none";
  editingPartyId = null;
  partyDraftMembers = [];
}

function renderPartyMemberCandidates(matches, user) {
  const el = document.getElementById("party-member-candidates");
  if (!matches.length) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.innerHTML = matches.map((u) =>
    `<div class="game-candidate" data-uid="${escapePartyText(u.uid)}">${escapePartyText(u.nickname)}</div>`
  ).join("");
  el.style.display = "block";
  el.querySelectorAll(".game-candidate").forEach((row) => {
    row.addEventListener("click", () => {
      const uid = row.dataset.uid;
      const u = allApprovedUsers.find((x) => x.uid === uid);
      partyDraftMembers.push(u);
      document.getElementById("party-member-search").value = "";
      renderPartyMemberCandidates([], user);
      renderPartyDraftMembers(user);
    });
  });
}

function renderPartyDraftMembers(user) {
  const el = document.getElementById("party-member-list");
  const ownerChip = `<span class="game-tag">${escapePartyText(nicknameOf(user.uid))} (본인)</span>`;
  const memberChips = partyDraftMembers.map((m, i) => `
    <span class="game-tag">
      ${escapePartyText(m.nickname)}
      <button type="button" data-idx="${i}" class="game-tag-remove">×</button>
    </span>
  `).join("");
  el.innerHTML = ownerChip + memberChips;
  el.querySelectorAll(".game-tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      partyDraftMembers.splice(Number(btn.dataset.idx), 1);
      renderPartyDraftMembers(user);
    });
  });
}

async function savePartyForm(user) {
  const name = document.getElementById("party-form-name").value.trim();
  const memberUids = partyDraftMembers.map((m) => m.uid);
  try {
    if (editingPartyId) {
      await updateParty(editingPartyId, user.uid, name, memberUids);
    } else {
      await createParty(user.uid, name, memberUids);
    }
    closePartyForm();
    await renderPartyList(user);
  } catch (e) {
    console.error("파티 저장 실패", e);
    showError("파티 저장 중 오류가 발생했습니다.");
  }
}

function escapePartyText(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML.replace(/"/g, "&quot;");
}
