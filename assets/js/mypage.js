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
    await withdraw(user, userData);
  });
});

async function withdraw(user, userData) {
  try {
    // 1. users 문서 삭제
    await deleteDoc(doc(db, "users", user.uid));

    // 3. Firebase Auth 계정 삭제
    await deleteUser(user);

    location.href = "/";
  } catch (err) {
    // 재인증이 필요한 경우 (구글 로그인은 최근 로그인이 오래된 경우 발생)
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
