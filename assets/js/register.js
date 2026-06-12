import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, collection, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;

// 이미 승인된 회원이면 게시판으로 보냄, 구글 로그인으로 온 경우 이메일 필드 숨김
onAuthStateChanged(auth, async (user) => {
  if (!user) return; // 로그인 안 한 상태면 그냥 register 페이지 유지
  currentUser = user;

  // 이미 Firestore에 approved로 등록된 경우 게시판으로
  const snap = await getDocs(query(collection(db, "users"), where("__name__", "==", user.uid)));
  if (!snap.empty && snap.docs[0].data().status === "approved") {
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

  // 닉네임 중복 확인
  const dupSnap = await getDocs(query(collection(db, "users"), where("nickname", "==", nickname)));
  if (!dupSnap.empty) { showError("이미 사용 중인 닉네임입니다."); return; }

  try {
    let user = currentUser;

    // 이메일 가입: 아직 로그인 안 된 상태에서 계정 생성
    if (!user || user.providerData[0]?.providerId !== "google.com") {
      const email = document.getElementById("input-email").value.trim();
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
    if (err.code === "auth/email-already-in-use") {
      showError("이미 가입된 이메일입니다. 로그인 페이지를 이용해주세요.");
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
