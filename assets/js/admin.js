import { auth, db } from "./firebase-init.js";
import { requireAdmin } from "./auth-guard.js";
import {
  collection, query, where, getDocs,
  doc, updateDoc, addDoc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let adminUser = null;
let adminData = null;

requireAdmin(async (user, userData) => {
  adminUser = user;
  adminData = userData;
  await loadPending();
  await loadMembers();
  setupTabs();
});

async function loadPending() {
  const q = query(collection(db, "users"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  const el = document.getElementById("list-pending");
  if (snap.empty) { el.innerHTML = "<p class='text-muted'>대기 중인 신청이 없습니다.</p>"; return; }

  el.innerHTML = snap.docs.map(d => {
    const u = d.data();
    return `
      <div class="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center">
        <div>
          <strong>${u.nickname}</strong>
          <span class="text-muted ms-2">${u.displayName}</span>
          <span class="text-muted ms-2">${u.email}</span>
        </div>
        <div>
          <button class="btn btn-sm btn-success me-1" onclick="setStatus('${d.id}','approved','${u.nickname}')">승인</button>
          <button class="btn btn-sm btn-danger" onclick="setStatus('${d.id}','rejected','${u.nickname}')">거절</button>
        </div>
      </div>`;
  }).join("");
}

async function loadMembers() {
  const q = query(collection(db, "users"), where("status", "==", "approved"));
  const snap = await getDocs(q);
  const el = document.getElementById("list-members");
  if (snap.empty) { el.innerHTML = "<p class='text-muted'>승인된 회원이 없습니다.</p>"; return; }

  el.innerHTML = snap.docs.map(d => {
    const u = d.data();
    return `
      <div class="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center">
        <div>
          <strong>${u.nickname}</strong>
          <span class="text-muted ms-2">${u.email}</span>
        </div>
        <button class="btn btn-sm btn-outline-danger" onclick="setStatus('${d.id}','rejected','${u.nickname}')">강제 탈퇴</button>
      </div>`;
  }).join("");
}

window.setStatus = async (targetUid, status, targetNickname) => {
  await updateDoc(doc(db, "users", targetUid), { status });

  // 로그 기록
  const actionMap = { approved: "승인", rejected: "거절/강제탈퇴" };
  await addDoc(collection(db, "admin_logs"), {
    action: actionMap[status] || status,
    targetUid,
    targetNickname,
    adminUid: adminUser.uid,
    adminNickname: adminData.nickname,
    createdAt: serverTimestamp()
  });

  await loadPending();
  await loadMembers();
};

function setupTabs() {
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-pending").style.display = btn.dataset.tab === "pending" ? "block" : "none";
      document.getElementById("tab-members").style.display = btn.dataset.tab === "members" ? "block" : "none";
    });
  });
}
