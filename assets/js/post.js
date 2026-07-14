import { auth, db } from "./firebase-init.js";
import { requireApproved, getUserDoc } from "./auth-guard.js";
import { getRatingTargets, canRateNow, ratingDocId, computeAverages } from "./rating-logic.js";
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, query, where, orderBy, getDocs,
  addDoc, deleteDoc, serverTimestamp, runTransaction,
  increment, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const postId = new URLSearchParams(location.search).get("id");
let currentUser = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML.replace(/"/g, "&quot;");
}

function formatEventDate(ts) {
  if (!ts) return "";
  const d = ts.toDate();
  const date = d.toLocaleDateString("ko-KR");
  const h = d.getHours(), m = d.getMinutes();
  return (h || m) ? `${date} ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` : date;
}

function renderGamesSection(games) {
  if (!games || !games.length) return "";
  const cards = games.map((g) => `
    <a class="game-card" href="https://boardgamegeek.com/boardgame/${escapeHtml(g.bggId)}" target="_blank" rel="noopener">
      ${g.thumbnail ? `<img src="${escapeHtml(g.thumbnail)}" alt="${escapeHtml(g.name)}">` : `<div class="game-card-noimg"></div>`}
      <span>${escapeHtml(g.name)}${g.yearPublished ? ` (${g.yearPublished})` : ""}</span>
    </a>
  `).join("");
  return `
    <div class="post-games-section">
      <p class="attendee-section-title">함께 할 게임</p>
      <div class="game-card-list">${cards}</div>
    </div>
  `;
}

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

  const canEdit = currentUser.uid === postData.authorUid || currentUserData.isAdmin;
  const editBtn = canEdit
    ? `<a href="/write/?edit=${postId}" style="background:none;border:1px solid #bbb;color:#555;border-radius:4px;font-size:0.78rem;padding:4px 10px;cursor:pointer;text-decoration:none;display:inline-block">수정</a>`
    : "";
  const deleteBtn = canEdit
    ? `<button style="background:none;border:1px solid var(--danger);color:var(--danger);border-radius:4px;font-size:0.78rem;padding:4px 10px;cursor:pointer;" id="btn-delete-post">삭제</button>`
    : "";
  const kakaoBtn = postData.type === "event"
    ? `<button style="background:#FEE500;border:none;color:#000;border-radius:4px;font-size:0.78rem;padding:4px 10px;cursor:pointer;" id="btn-kakao-share">카톡으로 공유</button>`
    : "";

  document.getElementById("post-content").innerHTML = `
    <div class="post-header">
      <span class="post-type-badge">${postData.type === "event" ? "일정" : "공지"}</span>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <h2 class="post-title">${postData.title}</h2>
        <div style="flex-shrink:0;display:flex;gap:6px">${kakaoBtn}${editBtn}${deleteBtn}</div>
      </div>
      <div class="post-meta">
        <span>${authorName}</span>
        <span>${date}</span>
        ${postData.type === "event" ? `<span>📅 ${formatEventDate(postData.eventDate)}</span>` : ""}
      </div>
    </div>
    <div class="post-body">${postData.content}</div>
  `;
  document.getElementById("post-content").insertAdjacentHTML("afterend", renderGamesSection(postData.games));

  if (postData.type === "event") {
    document.getElementById("btn-kakao-share").addEventListener("click", () => {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: postData.title,
          description: `📅 ${formatEventDate(postData.eventDate)}`,
          imageUrl: "https://www.jdkclub.click/assets/img/jdk2.jpeg",
          link: { webUrl: location.href, mobileWebUrl: location.href }
        },
        buttons: [{
          title: "일정 보기",
          link: { webUrl: location.href, mobileWebUrl: location.href }
        }]
      });
    });
  }

  if (canEdit) {
    document.getElementById("btn-delete-post").addEventListener("click", async () => {
      if (!confirm("게시글을 삭제하시겠습니까?")) return;
      await deleteDoc(doc(db, "posts", postId));
      location.href = "/board/";
    });
  }

  if (postData.type === "event") {
    await loadAttendees();
    await setupConfirmAttendance();
    setupAttendButtons();
    await setupRatingSection();
    document.getElementById("section-comments").style.display = "block";
    await loadComments();
    setupCommentForm();
  }
}

async function loadAttendees() {
  const attendees = postData.attendees || [];
  document.getElementById("section-attendees").style.display = "block";
  document.getElementById("attendee-count").textContent = `(${attendees.length}/${postData.maxAttendees}명)`;

  const statsSnap = await getDoc(doc(db, "stats", "global"));
  const membersStats = statsSnap.data()?.members || {};

  const entries = await Promise.all(attendees.map(async (uid) => {
    const u = await getUserDoc(uid);
    return { uid, name: u?.nickname || "알 수 없음" };
  }));

  document.getElementById("attendee-list").innerHTML = entries
    .map(({ uid, name }) => `<span class="attendee-chip" data-uid="${escapeHtml(uid)}">${escapeHtml(name)}</span>`)
    .join("");

  document.querySelectorAll(".attendee-chip[data-uid]").forEach((chip) => {
    const uid = chip.dataset.uid;
    bindRatingHoverCard(chip, computeAverages(membersStats[uid]));
  });
}

let ratingHoverCardEl = null;
let ratingHoverHideTimer = null;

function getRatingHoverCard() {
  if (ratingHoverCardEl) return ratingHoverCardEl;
  ratingHoverCardEl = document.createElement("div");
  ratingHoverCardEl.className = "rating-hovercard";
  document.body.appendChild(ratingHoverCardEl);
  ratingHoverCardEl.addEventListener("mouseenter", () => clearTimeout(ratingHoverHideTimer));
  ratingHoverCardEl.addEventListener("mouseleave", scheduleHideRatingHoverCard);
  return ratingHoverCardEl;
}

function scheduleHideRatingHoverCard() {
  clearTimeout(ratingHoverHideTimer);
  ratingHoverHideTimer = setTimeout(() => {
    if (ratingHoverCardEl) ratingHoverCardEl.style.display = "none";
  }, 120);
}

function bindRatingHoverCard(anchorEl, averages) {
  anchorEl.addEventListener("mouseenter", () => {
    clearTimeout(ratingHoverHideTimer);
    const card = getRatingHoverCard();
    card.innerHTML = averages.count === 0
      ? `<p class="rating-hovercard-empty">아직 평가 없음</p>`
      : `<div class="rating-hovercard-scores">
          <span>매너 ${averages.manner}</span>
          <span>실력 ${averages.skill}</span>
          <span>재만남 ${averages.again}</span>
        </div>
        <p class="rating-hovercard-count">${averages.count}회 평가받음</p>`;
    card.style.display = "block";
    const rect = anchorEl.getBoundingClientRect();
    card.style.left = `${rect.left + window.scrollX}px`;
    card.style.top = `${rect.bottom + window.scrollY + 6}px`;
  });
  anchorEl.addEventListener("mouseleave", scheduleHideRatingHoverCard);
}

async function setupConfirmAttendance() {
  const canConfirm = currentUser.uid === postData.authorUid || currentUserData.isAdmin;
  if (!canConfirm) return;

  const attendees = postData.attendees || [];
  if (!attendees.length) return;

  document.getElementById("section-confirm-attendance").style.display = "block";
  const confirmed = postData.confirmedAttendees || attendees;

  const names = await Promise.all(attendees.map(async (uid) => {
    const u = await getUserDoc(uid);
    return { uid, name: u?.nickname || "알 수 없음" };
  }));

  document.getElementById("confirm-attendance-list").innerHTML = names.map(({ uid, name }) => `
    <label style="display:flex;align-items:center;gap:6px;margin:4px 0;font-size:0.86rem">
      <input type="checkbox" class="confirm-attendance-checkbox" value="${escapeHtml(uid)}" ${confirmed.includes(uid) ? "checked" : ""}>
      ${escapeHtml(name)}
    </label>
  `).join("");

  document.getElementById("btn-save-confirmed").addEventListener("click", async () => {
    const checked = [...document.querySelectorAll(".confirm-attendance-checkbox:checked")].map((el) => el.value);
    await updateDoc(doc(db, "posts", postId), { confirmedAttendees: checked });
    postData.confirmedAttendees = checked;
    document.getElementById("msg-confirm-saved").style.display = "block";
  });
}

async function setupRatingSection() {
  if (!canRateNow(postData.eventDate.toDate())) return;
  const targets = getRatingTargets(postData, currentUser.uid);
  if (!targets.length) return;

  document.getElementById("section-rating").style.display = "block";

  const existing = await Promise.all(targets.map(async (targetUid) => {
    const snap = await getDoc(doc(db, "ratings", ratingDocId(postId, currentUser.uid, targetUid)));
    return [targetUid, snap.exists()];
  }));
  const submittedMap = Object.fromEntries(existing);

  if (targets.every((uid) => submittedMap[uid])) {
    document.getElementById("msg-rating-done").style.display = "block";
    return;
  }

  const names = await Promise.all(targets.map(async (uid) => {
    const u = await getUserDoc(uid);
    return { uid, name: u?.nickname || "알 수 없음" };
  }));

  document.getElementById("rating-list").innerHTML = names.map(({ uid, name }) => {
    if (submittedMap[uid]) {
      return `<div class="rating-row rating-row--done">
        <span class="rating-row-name">${escapeHtml(name)}</span>
        <span class="text-muted" style="font-size:0.8rem">제출 완료</span>
      </div>`;
    }
    return `<div class="rating-row" data-uid="${escapeHtml(uid)}">
      <span class="rating-row-name">${escapeHtml(name)}</span>
      <label class="rating-noshow"><input type="checkbox" class="rating-noshow-check"> 불참</label>
      <div class="rating-scores">
        <label>매너 <select class="rating-score" data-field="manner">${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join("")}</select></label>
        <label>실력 <select class="rating-score" data-field="skill">${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join("")}</select></label>
        <label>재만남 <select class="rating-score" data-field="again">${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join("")}</select></label>
      </div>
      <button class="btn-attend-action join btn-submit-rating">제출</button>
    </div>`;
  }).join("");

  document.getElementById("rating-list").querySelectorAll(".rating-row[data-uid]").forEach((row) => {
    const targetUid = row.dataset.uid;
    const noShowCheck = row.querySelector(".rating-noshow-check");
    const scoresEl = row.querySelector(".rating-scores");
    noShowCheck.addEventListener("change", () => {
      scoresEl.style.display = noShowCheck.checked ? "none" : "flex";
    });
    row.querySelector(".btn-submit-rating").addEventListener("click", async () => {
      const noShow = noShowCheck.checked;
      const payload = { postId, raterUid: currentUser.uid, targetUid, noShow, createdAt: serverTimestamp() };
      if (!noShow) {
        row.querySelectorAll(".rating-score").forEach((sel) => {
          payload[sel.dataset.field] = Number(sel.value);
        });
      }
      const ratingRef = doc(db, "ratings", ratingDocId(postId, currentUser.uid, targetUid));
      try {
        await runTransaction(db, async (tx) => {
          const existing = await tx.get(ratingRef);
          if (existing.exists()) throw new Error("이미 제출됨");
          tx.set(ratingRef, payload);
        });
      } catch (e) {
        alert("이미 제출된 평가이거나 오류가 발생했습니다.");
        return;
      }
      if (!noShow) {
        await setDoc(doc(db, "stats", "global"), {
          updatedAt: serverTimestamp(),
          [`members.${targetUid}.ratingSum.manner`]: increment(payload.manner),
          [`members.${targetUid}.ratingSum.skill`]: increment(payload.skill),
          [`members.${targetUid}.ratingSum.again`]: increment(payload.again),
          [`members.${targetUid}.ratingCount`]: increment(1)
        }, { merge: true });
      }
      location.reload();
    });
  });
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
    } catch (e) {
      alert(e.message === "마감" ? "정원이 마감됐습니다." : "오류가 발생했습니다.");
      return;
    }
    try {
      await setDoc(doc(db, "stats", "global"), {
        updatedAt: serverTimestamp(),
        [`members.${currentUser.uid}.nickname`]: currentUserData.nickname,
        [`members.${currentUser.uid}.attendCount`]: increment(1),
        [`members.${currentUser.uid}.postCount`]: increment(0)
      }, { merge: true });
    } catch (e) {
      console.error("stats update failed", e);
    }
    location.reload();
  });

  document.getElementById("btn-cancel").addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "posts", postId), { attendees: arrayRemove(currentUser.uid) });
    } catch (e) {
      alert("오류가 발생했습니다.");
      return;
    }
    try {
      const statsSnap = await getDoc(doc(db, "stats", "global"));
      const currentCount = statsSnap.data()?.members?.[currentUser.uid]?.attendCount || 0;
      if (currentCount > 0) {
        await setDoc(doc(db, "stats", "global"), {
          updatedAt: serverTimestamp(),
          [`members.${currentUser.uid}.nickname`]: currentUserData.nickname,
          [`members.${currentUser.uid}.attendCount`]: increment(-1),
          [`members.${currentUser.uid}.postCount`]: increment(0)
        }, { merge: true });
      }
    } catch (e) {
      console.error("stats update failed", e);
    }
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

  const allComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const roots = allComments.filter(c => !c.parentId);
  const replies = allComments.filter(c => !!c.parentId);

  const nicknameCache = {};
  async function getNickname(uid) {
    if (!nicknameCache[uid]) {
      const u = await getUserDoc(uid);
      nicknameCache[uid] = u?.nickname || "알 수 없음";
    }
    return nicknameCache[uid];
  }

  const rows = await Promise.all(roots.map(async (c) => {
    const name = await getNickname(c.authorUid);
    const date = c.createdAt?.toDate().toLocaleString("ko-KR") || "";
    const canDelete = c.authorUid === currentUser.uid || currentUserData.isAdmin;
    const deleteBtn = canDelete
      ? `<button style="background:none;border:none;color:var(--danger);font-size:0.75rem;cursor:pointer;padding:0;" onclick="deleteComment('${c.id}')">삭제</button>`
      : "";
    const replyBtn = `<button style="background:none;border:none;color:var(--text-muted);font-size:0.75rem;cursor:pointer;padding:0;" onclick="toggleReplyForm('${c.id}')">답글</button>`;

    const childReplies = replies.filter(r => r.parentId === c.id);
    const replyRows = await Promise.all(childReplies.map(async (r) => {
      const rName = await getNickname(r.authorUid);
      const rDate = r.createdAt?.toDate().toLocaleString("ko-KR") || "";
      const rCanDelete = r.authorUid === currentUser.uid || currentUserData.isAdmin;
      const rDeleteBtn = rCanDelete
        ? `<button style="background:none;border:none;color:var(--danger);font-size:0.75rem;cursor:pointer;padding:0;" onclick="deleteComment('${r.id}')">삭제</button>`
        : "";
      return `<div class="comment-item comment-reply">
        <div style="display:flex;gap:8px;align-items:center">
          <span style="color:var(--text-muted);font-size:0.8rem">↳</span>
          <span class="comment-author">${rName}</span>
          ${rDeleteBtn}
        </div>
        <div class="comment-text">${r.content}</div>
        <div class="comment-time">${rDate}</div>
      </div>`;
    }));

    return `<div class="comment-item">
      <div style="display:flex;gap:8px;align-items:center">
        <span class="comment-author">${name}</span>
        ${replyBtn}
        ${deleteBtn}
      </div>
      <div class="comment-text">${c.content}</div>
      <div class="comment-time">${date}</div>
    </div>
    ${replyRows.join("")}
    <div id="reply-form-${c.id}" style="display:none;margin-left:20px;margin-bottom:8px">
      <form onsubmit="submitReply(event, '${c.id}')">
        <div class="comment-input-row">
          <input type="text" placeholder="답글을 입력하세요" maxlength="200" id="reply-input-${c.id}">
          <button type="submit">등록</button>
        </div>
      </form>
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

window.toggleReplyForm = (commentId) => {
  const el = document.getElementById(`reply-form-${commentId}`);
  if (!el) return;
  const isHidden = el.style.display === "none";
  el.style.display = isHidden ? "block" : "none";
  if (isHidden) document.getElementById(`reply-input-${commentId}`)?.focus();
};

window.submitReply = async (e, parentId) => {
  e.preventDefault();
  const input = document.getElementById(`reply-input-${parentId}`);
  const content = input?.value.trim();
  if (!content) return;
  await addDoc(collection(db, "comments"), {
    postId, content, parentId,
    authorUid: currentUser.uid,
    createdAt: serverTimestamp()
  });
  location.reload();
};

window.deleteComment = async (commentId) => {
  if (!confirm("삭제하시겠습니까?")) return;
  // 댓글 삭제 시 해당 댓글의 대댓글도 함께 삭제
  const snap = await getDocs(query(
    collection(db, "comments"),
    where("parentId", "==", commentId)
  ));
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "comments", d.id))));
  await deleteDoc(doc(db, "comments", commentId));
  location.reload();
};
