import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists() && snap.data().status === "approved") {
    location.href = "/board/";
    return;
  }

  if (user.providerData[0]?.providerId === "google.com") {
    document.getElementById("section-email-fields").style.display = "none";
    document.getElementById("section-google-done").style.display = "block";
  }
});

document.getElementById("form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = document.getElementById("input-nickname").value.trim();
  if (!nickname) { showError("닉네임을 입력해주세요."); return; }
  if (!document.getElementById("checkbox-privacy").checked) { showError("개인정보 수집 및 이용에 동의해주세요."); return; }

  try {
    let user = currentUser;

    if (!user || user.providerData[0]?.providerId !== "google.com") {
      const email = document.getElementById("input-email").value.trim();
      const password = document.getElementById("input-password").value;
      if (!email || !password) { showError("이메일과 비밀번호를 입력해주세요."); return; }

      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          // 이미 Auth 계정 있음 — 로그인 후 Firestore 재신청
          try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            user = result.user;
          } catch (loginErr) {
            showError("이미 가입된 이메일입니다. 비밀번호를 확인하거나 운영자에게 문의하세요.");
            return;
          }
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists() && snap.data().status === "pending") {
            showError("이미 가입 신청 중입니다. 운영자 승인을 기다려주세요.");
            return;
          }
          if (snap.exists() && snap.data().status === "approved") {
            location.href = "/board/";
            return;
          }
          // rejected 또는 문서 없음 → 재신청 허용
        } else {
          throw err;
        }
      }
    }

    // 닉네임 중복 확인 (본인 제외)
    const dupSnap = await getDocs(query(collection(db, "users"), where("nickname", "==", nickname)));
    const isDup = dupSnap.docs.some(d => d.id !== user.uid);
    if (isDup) { showError("이미 사용 중인 닉네임입니다."); return; }

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
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      showError("비밀번호가 올바르지 않습니다.");
    } else {
      showError(err.message);
    }
  }
});

function showError(msg) {
  const el = document.getElementById("msg-error");
  el.textContent = msg;
  el.style.display = "block";
}
