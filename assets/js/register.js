import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, collection, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (!user) { location.href = "/login.html"; return; }
  currentUser = user;
  if (user.providerData[0]?.providerId === "google.com") {
    document.getElementById("section-email-fields").style.display = "none";
    document.getElementById("section-google-done").style.display = "block";
  }
});

document.getElementById("form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = document.getElementById("input-nickname").value.trim();
  if (!nickname) { showError("닉네임을 입력해주세요."); return; }

  const q = query(collection(db, "users"), where("nickname", "==", nickname));
  const snap = await getDocs(q);
  if (!snap.empty) { showError("이미 사용 중인 닉네임입니다."); return; }

  try {
    let user = currentUser;

    if (user.providerData[0]?.providerId !== "google.com") {
      const email = document.getElementById("input-email").value;
      const password = document.getElementById("input-password").value;
      if (!email || !password) { showError("이메일과 비밀번호를 입력해주세요."); return; }
      const result = await createUserWithEmailAndPassword(auth, email, password);
      user = result.user;
    }

    await setDoc(doc(db, "users", user.uid), {
      status: "pending",
      nickname,
      displayName: user.displayName || "",
      email: user.email || "",
      isAdmin: false,
      createdAt: serverTimestamp()
    });

    document.getElementById("form-register").style.display = "none";
    document.getElementById("msg-success").style.display = "block";
  } catch (err) {
    showError(err.message);
  }
});

function showError(msg) {
  const el = document.getElementById("msg-error");
  el.textContent = msg;
  el.style.display = "block";
}
