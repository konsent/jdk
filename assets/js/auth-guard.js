import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 한 페이지 안에서 같은 uid 를 반복 조회하지 않도록 캐시한다.
// 참석자 목록·댓글 작성자 등에서 같은 사람이 여러 번 등장하면 그만큼 문서 읽기가 중복됐다.
// 페이지 이동(새로고침) 시 자연히 비워지므로 별도 무효화 주기는 두지 않는다.
const userDocCache = new Map();

export async function getUserDoc(uid) {
  if (!uid) return null;
  if (userDocCache.has(uid)) return userDocCache.get(uid);

  // 동시에 같은 uid 를 요청해도 네트워크 요청은 한 번만 나가도록 Promise 자체를 캐싱한다.
  const promise = getDoc(doc(db, "users", uid))
    .then((snap) => (snap.exists() ? snap.data() : null))
    .catch((err) => {
      userDocCache.delete(uid); // 실패한 결과는 캐시에 남기지 않는다
      throw err;
    });

  userDocCache.set(uid, promise);
  return promise;
}

/** 본인 문서를 직접 갱신한 직후처럼 캐시가 낡았을 때 비운다. */
export function invalidateUserDoc(uid) {
  if (uid) userDocCache.delete(uid);
  else userDocCache.clear();
}

export function requireApproved(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.href = "/login/"; return; }
    try {
      const data = await getUserDoc(user.uid);
      if (!data || data.status !== "approved") { location.href = "/login/"; return; }
      callback(user, data);
    } catch (err) {
      console.error("회원 정보 조회 실패", err);
      location.href = "/login/";
    }
  });
}

export function requireAdmin(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.href = "/login/"; return; }
    try {
      const data = await getUserDoc(user.uid);
      if (!data || !data.isAdmin) { location.href = "/board/"; return; }
      callback(user, data);
    } catch (err) {
      console.error("관리자 정보 조회 실패", err);
      location.href = "/board/";
    }
  });
}
