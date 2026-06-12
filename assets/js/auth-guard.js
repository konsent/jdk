import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function requireApproved(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.href = "/login.html"; return; }
    const data = await getUserDoc(user.uid);
    if (!data || data.status !== "approved") { location.href = "/login.html"; return; }
    callback(user, data);
  });
}

export function requireAdmin(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.href = "/login.html"; return; }
    const data = await getUserDoc(user.uid);
    if (!data || !data.isAdmin) { location.href = "/board.html"; return; }
    callback(user, data);
  });
}
