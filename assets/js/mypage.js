import { auth, db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import { deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
