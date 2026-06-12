import { db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import {
  collection, addDoc, serverTimestamp, Timestamp,
  doc, setDoc, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;

requireApproved((user, userData) => {
  currentUser = user;
  currentUserData = userData;

  if (userData.isAdmin) {
    document.getElementById("section-type").style.display = "block";
  }

  function updateEventFields() {
    const type = document.getElementById("select-type").value;
    document.getElementById("section-event-fields").style.display =
      type === "event" ? "block" : "none";
  }

  document.getElementById("select-type").addEventListener("change", updateEventFields);
  updateEventFields();
});

document.getElementById("form-write").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("input-title").value.trim();
  const content = document.getElementById("input-content").value.trim();
  const type = currentUserData?.isAdmin
    ? document.getElementById("select-type").value
    : "event";

  if (!title || !content) { showError("제목과 내용을 입력해주세요."); return; }

  const postData = {
    type, title, content,
    authorUid: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (type === "event") {
    const dateStr = document.getElementById("input-date").value;
    const maxAttendees = parseInt(document.getElementById("input-max").value, 10);
    if (!dateStr) { showError("일정 날짜를 선택해주세요."); return; }
    postData.eventDate = Timestamp.fromDate(new Date(dateStr));
    postData.maxAttendees = maxAttendees;
    postData.attendees = [currentUser.uid];
  }

  try {
    const ref = await addDoc(collection(db, "posts"), postData);

    if (type === "event") {
      await setDoc(doc(db, "stats", "global"), {
        updatedAt: serverTimestamp(),
        [`members.${currentUser.uid}.nickname`]: currentUserData.nickname,
        [`members.${currentUser.uid}.postCount`]: increment(1),
        [`members.${currentUser.uid}.attendCount`]: increment(0)
      }, { merge: true });
    }

    location.href = `/post/?id=${ref.id}`;
  } catch (err) {
    showError("등록 중 오류가 발생했습니다.");
  }
});

function showError(msg) {
  const el = document.getElementById("msg-error");
  el.textContent = msg;
  el.style.display = "block";
}
