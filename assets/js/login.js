import { auth, db } from "./firebase-init.js";
import {
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function redirectByStatus(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) { location.href = "/register/"; return; }
  const { status } = snap.data();
  if (status === "approved") { location.href = "/board/"; return; }
  document.getElementById("msg-pending").style.display = status === "pending" ? "block" : "none";
  document.getElementById("msg-rejected").style.display = status === "rejected" ? "block" : "none";
}

onAuthStateChanged(auth, (user) => {
  if (user) redirectByStatus(user.uid);
});

document.getElementById("btn-google").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await redirectByStatus(result.user.uid);
  } catch (e) {
    showError(e.message);
  }
});

document.getElementById("form-email").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("input-email").value;
  const password = document.getElementById("input-password").value;
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await redirectByStatus(result.user.uid);
  } catch (e) {
    showError("이메일 또는 비밀번호가 올바르지 않습니다.");
  }
});

function showError(msg) {
  const el = document.getElementById("msg-error");
  el.textContent = msg;
  el.style.display = "block";
}

const resetModal = document.getElementById("reset-modal");
const resetEmailInput = document.getElementById("input-reset-email");
const resetModalMsg = document.getElementById("reset-modal-msg");

function openResetModal() {
  resetEmailInput.value = document.getElementById("input-email").value || "";
  resetModalMsg.style.display = "none";
  resetModal.style.display = "flex";
}

function closeResetModal() {
  resetModal.style.display = "none";
}

document.getElementById("link-forgot-password").addEventListener("click", (e) => {
  e.preventDefault();
  openResetModal();
});

document.getElementById("reset-modal-cancel-btn").addEventListener("click", closeResetModal);

resetModal.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeResetModal();
});

document.getElementById("reset-modal-send-btn").addEventListener("click", async () => {
  const email = resetEmailInput.value.trim();
  try {
    await sendPasswordResetEmail(auth, email);
    showResetModalMessage("입력하신 이메일로 재설정 링크를 보냈습니다. 계정이 존재하지 않는 경우 메일이 오지 않을 수 있습니다.", "#2e7d32");
  } catch (err) {
    if (err.code === "auth/invalid-email") {
      showResetModalMessage("이메일 형식이 올바르지 않습니다.", "#c62828");
    } else {
      showResetModalMessage("입력하신 이메일로 재설정 링크를 보냈습니다. 계정이 존재하지 않는 경우 메일이 오지 않을 수 있습니다.", "#2e7d32");
    }
  }
});

function showResetModalMessage(text, color) {
  resetModalMsg.textContent = text;
  resetModalMsg.style.color = color;
  resetModalMsg.style.display = "block";
}
