import { db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import {
  collection, query, where, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

requireApproved(async () => {
  await loadNotices();
  const events = await loadEvents();
  renderCalendar(events);
  renderList(events);
  setupViewToggle();
});

async function loadNotices() {
  const q = query(
    collection(db, "posts"),
    where("type", "==", "notice"),
    orderBy("createdAt", "desc"),
    limit(3)
  );
  const snap = await getDocs(q);
  const el = document.getElementById("notice-list");
  if (snap.empty) { el.innerHTML = "<p class='text-muted'>공지사항이 없습니다.</p>"; return; }
  el.innerHTML = snap.docs.map(d => {
    const p = d.data();
    const date = p.createdAt?.toDate().toLocaleDateString("ko-KR") || "";
    return `<div class="notice-item">
      <a href="/post.html?id=${d.id}">${p.title}</a>
      <span class="text-muted ms-2 small">${date}</span>
    </div>`;
  }).join("");
}

async function loadEvents() {
  const q = query(
    collection(db, "posts"),
    where("type", "==", "event"),
    orderBy("eventDate", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderCalendar(events) {
  const calEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: "dayGridMonth",
    locale: "ko",
    events: events.map(e => ({
      id: e.id,
      title: e.title,
      start: e.eventDate.toDate()
    })),
    eventClick: (info) => { location.href = `/post.html?id=${info.event.id}`; }
  });
  calendar.render();
}

function renderList(events) {
  const el = document.getElementById("event-list");
  if (!events.length) {
    el.innerHTML = `<tr><td colspan="3" class="text-muted">등록된 일정이 없습니다.</td></tr>`;
    return;
  }
  el.innerHTML = events.map(e => {
    const date = e.eventDate?.toDate().toLocaleDateString("ko-KR") || "";
    const cnt = e.attendees?.length || 0;
    const badge = cnt >= e.maxAttendees
      ? `<span class="badge-full">${cnt}/${e.maxAttendees} 마감</span>`
      : `<span class="badge-open">${cnt}/${e.maxAttendees}</span>`;
    return `<tr class="event-row" onclick="location.href='/post.html?id=${e.id}'">
      <td>${date}</td><td>${e.title}</td><td>${badge}</td>
    </tr>`;
  }).join("");
}

function setupViewToggle() {
  document.getElementById("btn-calendar-view").addEventListener("click", () => {
    document.getElementById("calendar-view").style.display = "block";
    document.getElementById("list-view").style.display = "none";
  });
  document.getElementById("btn-list-view").addEventListener("click", () => {
    document.getElementById("calendar-view").style.display = "none";
    document.getElementById("list-view").style.display = "block";
  });
}
