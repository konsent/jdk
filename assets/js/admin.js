import { auth, db } from "./firebase-init.js";
import { requireAdmin } from "./auth-guard.js";
import {
  collection, query, where, getDocs, orderBy, limit, startAfter,
  doc, updateDoc, addDoc, deleteDoc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


let adminUser = null;
let adminData = null;
let pendingAction = null;

function maskEmail(email) {
  const [local, domain] = email.split("@");
  const masked = local.slice(0, 3) + "*".repeat(Math.max(local.length - 3, 1));
  return `${masked}@${domain}`;
}

requireAdmin(async (user, userData) => {
  adminUser = user;
  adminData = userData;
  await loadPending();
  await loadMembers();
  setupTabs();

  window.toggleAnnual = async (targetUid, current, targetNickname) => {
    const next = !current;
    await updateDoc(doc(db, "users", targetUid), { annualMember: next });
    await addDoc(collection(db, "admin_logs"), {
      action: next ? "연회원 지정" : "연회원 해제",
      targetUid, targetNickname,
      adminUid: adminUser.uid,
      adminNickname: adminData.nickname,
      createdAt: serverTimestamp()
    });
    await loadMembers();
  };
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
          <span class="text-muted ms-2">${maskEmail(u.email)}</span>
        </div>
        <div>
          <button class="btn btn-sm btn-success me-1" onclick="confirmAction('approve','${d.id}','${u.nickname}')">승인</button>
          <button class="btn btn-sm btn-danger" onclick="confirmAction('reject','${d.id}','${u.nickname}')">거절</button>
        </div>
      </div>`;
  }).join("");
}

async function loadMembers() {
  const q = query(collection(db, "users"), where("status", "==", "approved"));
  const snap = await getDocs(q);
  const el = document.getElementById("list-members");
  if (snap.empty) { el.innerHTML = "<p class='text-muted'>승인된 회원이 없습니다.</p>"; return; }
  document.getElementById("member-count").textContent = `전체 ${snap.size}명`;

  el.innerHTML = snap.docs.map(d => {
    const u = d.data();
    const adminTag = u.isAdmin
      ? `<span style="font-size:0.7rem;font-weight:600;background:#1a1a1a;color:#fff;border-radius:4px;padding:2px 7px;margin-left:6px;vertical-align:middle">관리자</span>`
      : "";
    const annualTag = u.annualMember
      ? `<span style="font-size:0.7rem;font-weight:600;background:#2e7d32;color:#fff;border-radius:4px;padding:2px 7px;margin-left:4px;vertical-align:middle">연회원</span>`
      : "";
    const annualBtn = u.annualMember
      ? `<button class="btn btn-sm btn-outline-secondary me-1" onclick="toggleAnnual('${d.id}',true,'${u.nickname}')">연회원 해제</button>`
      : `<button class="btn btn-sm btn-outline-success me-1" onclick="toggleAnnual('${d.id}',false,'${u.nickname}')">연회원 지정</button>`;
    return `
      <div class="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <strong>${u.nickname}</strong>${adminTag}${annualTag}
          <span class="text-muted ms-2" style="font-size:0.85rem">${maskEmail(u.email)}</span>
        </div>
        <div>
          ${annualBtn}
          ${d.id !== adminUser.uid ? `<button class="btn btn-sm btn-outline-danger" onclick="confirmAction('force-remove','${d.id}','${u.nickname}')">강제 탈퇴</button>` : ""}
        </div>
      </div>`;
  }).join("");
}

const LOG_PAGE_SIZE = 20;
let logCursors = [null]; // index 0 = 첫 페이지 커서(null), 이후는 각 페이지 마지막 doc
let logCurrentPage = 0;

async function loadLogs(page = 0) {
  const el = document.getElementById("list-logs");
  try {
    const cursor = logCursors[page];
    const q = cursor
      ? query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), startAfter(cursor), limit(LOG_PAGE_SIZE))
      : query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), limit(LOG_PAGE_SIZE));

    const snap = await getDocs(q);
    if (snap.empty && page === 0) { el.innerHTML = "<p class='text-muted'>로그가 없습니다.</p>"; return; }

    logCurrentPage = page;
    if (snap.docs.length === LOG_PAGE_SIZE && !logCursors[page + 1]) {
      logCursors[page + 1] = snap.docs[snap.docs.length - 1];
    }

    const rows = snap.docs.map(d => {
      const l = d.data();
      const date = l.createdAt?.toDate().toLocaleString("ko-KR") || "";
      return `<div class="card mb-1 p-2 px-3" style="font-size:0.85rem">
        <span class="text-muted">${date}</span>
        <span class="ms-2"><strong>${l.adminNickname}</strong> → <strong>${l.targetNickname}</strong>: ${l.action}</span>
      </div>`;
    }).join("");

    const hasPrev = page > 0;
    const hasNext = snap.docs.length === LOG_PAGE_SIZE;
    const pagination = `
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        <button class="btn btn-sm btn-outline-secondary" onclick="goLogPage(${page - 1})" ${hasPrev ? "" : "disabled"}>이전</button>
        <span style="line-height:2rem;font-size:0.85rem;color:#666">${page + 1}페이지</span>
        <button class="btn btn-sm btn-outline-secondary" onclick="goLogPage(${page + 1})" ${hasNext ? "" : "disabled"}>다음</button>
      </div>`;

    el.innerHTML = rows + pagination;
  } catch (e) {
    el.innerHTML = "<p class='text-muted'>로그를 불러올 수 없습니다.</p>";
  }
}

window.goLogPage = (page) => loadLogs(page);

// 모달 표시
window.confirmAction = (type, targetUid, targetNickname) => {
  const configs = {
    approve:      { title: "승인 확인",      desc: `${targetNickname} 님을 승인하시겠습니까?`,      btnText: "승인", btnColor: "#2e7d32" },
    reject:       { title: "거절 확인",      desc: `${targetNickname} 님의 신청을 거절하시겠습니까?`, btnText: "거절", btnColor: "#c62828" },
    "force-remove": { title: "강제 탈퇴 확인", desc: `${targetNickname} 님을 강제 탈퇴시키겠습니까?\n이 작업은 되돌릴 수 없습니다.`, btnText: "강제 탈퇴", btnColor: "#c62828" }
  };
  const cfg = configs[type];
  document.getElementById("modal-title").textContent = cfg.title;
  document.getElementById("modal-desc").textContent = cfg.desc;
  const btn = document.getElementById("modal-confirm-btn");
  btn.textContent = cfg.btnText;
  btn.style.background = cfg.btnColor;

  pendingAction = { type, targetUid, targetNickname };
  const modal = document.getElementById("confirm-modal");
  modal.style.display = "flex";

  btn.onclick = async () => {
    const action = pendingAction;
    closeModal();
    await executeAction(action);
  };
};

window.closeModal = () => {
  document.getElementById("confirm-modal").style.display = "none";
  pendingAction = null;
};

// 모달 바깥 클릭 시 닫기
document.getElementById("confirm-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

async function executeAction({ type, targetUid, targetNickname }) {
  const statusMap = { approve: "approved", reject: "rejected" };
  const actionMap = { approve: "승인", reject: "거절", "force-remove": "강제탈퇴" };

  if (type === "force-remove") {
    await deleteDoc(doc(db, "users", targetUid));
  } else {
    await updateDoc(doc(db, "users", targetUid), { status: statusMap[type] });
  }
  await addDoc(collection(db, "admin_logs"), {
    action: actionMap[type],
    targetUid,
    targetNickname,
    adminUid: adminUser.uid,
    adminNickname: adminData.nickname,
    createdAt: serverTimestamp()
  });

  await loadPending();
  await loadMembers();
}

function setupTabs() {
  let logsLoaded = false;
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-pending").style.display = btn.dataset.tab === "pending" ? "block" : "none";
      document.getElementById("tab-members").style.display = btn.dataset.tab === "members" ? "block" : "none";
      document.getElementById("tab-logs").style.display   = btn.dataset.tab === "logs"    ? "block" : "none";
      if (btn.dataset.tab === "logs" && !logsLoaded) {
        logsLoaded = true;
        await loadLogs();
      }
    });
  });
}
