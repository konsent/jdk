import { db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import {
  collection, query, where, orderBy, getDocs, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.getElementById("btn-calendar-view").addEventListener("click", () => {
  document.getElementById("calendar-view").style.display = "block";
  document.getElementById("list-view").style.display = "none";
});
document.getElementById("btn-list-view").addEventListener("click", () => {
  document.getElementById("calendar-view").style.display = "none";
  document.getElementById("list-view").style.display = "block";
});

requireApproved(async (user, userData) => {
  await loadNotices();
  const events = await loadEvents();
  renderCalendar(events);
  renderList(events);
  if (userData.isAdmin) {
    const link = document.getElementById("link-stats");
    if (link) link.style.display = "inline";
  }
});

async function loadNotices() {
  const el = document.getElementById("notice-list");
  try {
    const snap = await getDocs(query(
      collection(db, "posts"),
      where("type", "==", "notice"),
      limit(3)
    ));
    if (snap.empty) { el.innerHTML = "<p class='text-muted'>공지사항이 없습니다.</p>"; return; }
    el.innerHTML = snap.docs.map(d => {
      const p = d.data();
      return `<div class="notice-item"><a href="/post/?id=${d.id}">${p.title}</a></div>`;
    }).join("");
  } catch (e) {
    el.innerHTML = "<p class='text-muted'>공지사항이 없습니다.</p>";
  }
}

async function loadEvents() {
  try {
    const snap = await getDocs(query(
      collection(db, "posts"),
      where("type", "==", "event"),
      orderBy("eventDate", "asc")
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("이벤트 로드 실패:", e);
    return [];
  }
}

function renderCalendar(events) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

  function buildCalendar() {
    const el = document.getElementById("calendar");
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNames = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

    // 이 달의 이벤트만 필터
    const monthEvents = {};
    events.forEach(e => {
      const d = e.eventDate?.toDate();
      if (!d) return;
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!monthEvents[day]) monthEvents[day] = [];
        monthEvents[day].push(e);
      }
    });

    let html = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <button class="btn btn-sm btn-outline-secondary" id="cal-prev">◀</button>
        <strong>${year}년 ${monthNames[month]}</strong>
        <button class="btn btn-sm btn-outline-secondary" id="cal-next">▶</button>
      </div>
      <table class="table table-bordered text-center" style="table-layout:fixed">
        <thead><tr>
          <th>일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th>토</th>
        </tr></thead>
        <tbody>`;

    let day = 1;
    for (let row = 0; row < 6; row++) {
      if (day > daysInMonth) break;
      html += "<tr>";
      for (let col = 0; col < 7; col++) {
        if (row === 0 && col < firstDay || day > daysInMonth) {
          html += "<td></td>";
        } else {
          const evts = monthEvents[day] || [];
          const evtHtml = evts.map(e =>
            `<div style="font-size:0.7rem;background:#0d6efd;color:#fff;border-radius:3px;padding:1px 3px;margin-top:2px;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" onclick="location.href='/post/?id=${e.id}'">${e.title}</div>`
          ).join("");
          html += `<td style="height:60px;vertical-align:top;padding:4px">${day}${evtHtml}</td>`;
          day++;
        }
      }
      html += "</tr>";
    }

    html += "</tbody></table>";
    el.innerHTML = html;

    document.getElementById("cal-prev").addEventListener("click", () => {
      month--;
      if (month < 0) { month = 11; year--; }
      buildCalendar();
    });
    document.getElementById("cal-next").addEventListener("click", () => {
      month++;
      if (month > 11) { month = 0; year++; }
      buildCalendar();
    });
  }

  buildCalendar();
}

function renderList(events) {
  const el = document.getElementById("event-list");
  el.innerHTML = ""; // 불러오는 중... 제거
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
    return `<tr class="event-row" onclick="location.href='/post/?id=${e.id}'">
      <td>${date}</td><td>${e.title}</td><td>${badge}</td>
    </tr>`;
  }).join("");
}
