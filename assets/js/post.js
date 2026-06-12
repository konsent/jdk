import { auth, db } from "./firebase-init.js";
import { requireApproved, getUserDoc } from "./auth-guard.js";
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, query, where, orderBy, getDocs,
  addDoc, deleteDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const postId = new URLSearchParams(location.search).get("id");
let currentUser = null;
let currentUserData = null;
let postData = null;

requireApproved(async (user, userData) => {
  currentUser = user;
  currentUserData = userData;
  await loadPost();
});

async function loadPost() {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) {
    document.getElementById("post-content").innerHTML = "<p>게시글을 찾을 수 없습니다.</p>";
    return;
  }
  postData = snap.data();

  const date = postData.createdAt?.toDate().toLocaleDateString("ko-KR") || "";
  const authorDoc = await getUserDoc(postData.authorUid);
  const authorName = authorDoc?.nickname || "알 수 없음";

  let eventInfo = "";
  if (postData.type === "event") {
    const eventDate = postData.eventDate?.toDate().toLocaleDateString("ko-KR") || "";
    eventInfo = `<p class="text-muted">📅 일정 날짜: <strong>${eventDate}</strong></p>`;
  }

  const canDelete = currentUser.uid === postData.authorUid || currentUserData.isAdmin;
  const deleteBtn = canDelete
    ? `<button style="background:none;border:1px solid var(--danger);color:var(--danger);border-radius:4px;font-size:0.78rem;padding:4px 10px;cursor:pointer;" id="btn-delete-post">삭제</button>`
    : "";

  document.getElementById("post-content").innerHTML = `
    <div class="post-header">
      <span class="post-type-badge">${postData.type === "event" ? "일정" : "공지"}</span>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h2 class="post-title">${postData.title}</h2>
        <div style="flex-shrink:0">${deleteBtn}</div>
      </div>
      <div class="post-meta">
        <span>${authorName}</span>
        <span>${date}</span>
        ${postData.type === "event" ? `<span>📅 ${postData.eventDate?.toDate().toLocaleDateString("ko-KR") || ""}</span>` : ""}
      </div>
    </div>
    <div class="post-body">${postData.content}</div>
  `;

  if (canDelete) {
    document.getElementById("btn-delete-post").addEventListener("click", async () => {
      if (!confirm("게시글을 삭제하시겠습니까?")) return;
      await deleteDoc(doc(db, "posts", postId));
      location.href = "/board/";
    });
  }

  if (postData.type === "event") {
    await loadAttendees();
    setupAttendButtons();
    document.getElementById("section-comments").style.display = "block";
    await loadComments();
    setupCommentForm();
  }
}

async function loadAttendees() {
  const attendees = postData.attendees || [];
  document.getElementById("section-attendees").style.display = "block";
  document.getElementById("attendee-count").textContent = `(${attendees.length}/${postData.maxAttendees}명)`;

  const names = await Promise.all(attendees.map(async (uid) => {
    const u = await getUserDoc(uid);
    return u?.nickname || "알 수 없음";
  }));
  document.getElementById("attendee-list").innerHTML = names
    .map(n => `<span class="attendee-chip">${n}</span>`).join("");
}

function setupAttendButtons() {
  const attendees = postData.attendees || [];
  const isAttending = attendees.includes(currentUser.uid);
  const isFull = attendees.length >= postData.maxAttendees;

  document.getElementById("btn-attend").style.display = (!isAttending && !isFull) ? "inline-block" : "none";
  document.getElementById("btn-cancel").style.display = isAttending ? "inline-block" : "none";
  document.getElementById("msg-full").style.display = (!isAttending && isFull) ? "block" : "none";

  document.getElementById("btn-attend").addEventListener("click", async () => {
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "posts", postId);
        const latest = await tx.get(ref);
        const latestAttendees = latest.data().attendees || [];
        if (latestAttendees.length >= postData.maxAttendees) throw new Error("마감");
        if (latestAttendees.includes(currentUser.uid)) throw new Error("이미 신청");
        tx.update(ref, { attendees: arrayUnion(currentUser.uid) });
      });
      location.reload();
    } catch (e) {
      alert(e.message === "마감" ? "정원이 마감됐습니다." : "오류가 발생했습니다.");
    }
  });

  document.getElementById("btn-cancel").addEventListener("click", async () => {
    await updateDoc(doc(db, "posts", postId), { attendees: arrayRemove(currentUser.uid) });
    location.reload();
  });
}

async function loadComments() {
  const q = query(
    collection(db, "comments"),
    where("postId", "==", postId),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  const el = document.getElementById("comment-list");
  if (snap.empty) { el.innerHTML = "<p class='text-muted small'>댓글이 없습니다.</p>"; return; }

  const rows = await Promise.all(snap.docs.map(async (d) => {
    const c = d.data();
    const u = await getUserDoc(c.authorUid);
    const name = u?.nickname || "알 수 없음";
    const date = c.createdAt?.toDate().toLocaleString("ko-KR") || "";
    const deleteBtn = (c.authorUid === currentUser.uid || currentUserData.isAdmin)
      ? `<button style="background:none;border:none;color:var(--danger);font-size:0.75rem;cursor:pointer;padding:0 0 0 8px;" onclick="deleteComment('${d.id}')">삭제</button>`
      : "";
    return `<div class="comment-item">
      <div><span class="comment-author">${name}</span>${deleteBtn}</div>
      <div class="comment-text">${c.content}</div>
      <div class="comment-time">${date}</div>
    </div>`;
  }));
  el.innerHTML = rows.join("");
}

function setupCommentForm() {
  document.getElementById("form-comment").addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = document.getElementById("input-comment").value.trim();
    if (!content) return;
    await addDoc(collection(db, "comments"), {
      postId, content,
      authorUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    location.reload();
  });
}

window.deleteComment = async (commentId) => {
  if (!confirm("댓글을 삭제하시겠습니까?")) return;
  await deleteDoc(doc(db, "comments", commentId));
  location.reload();
};
