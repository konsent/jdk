import { auth, db } from "./firebase-init.js";
import {
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, onAuthStateChanged
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
