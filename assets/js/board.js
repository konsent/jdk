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
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => !e.isAnniversary);
  } catch (e) {
    console.error("이벤트 로드 실패:", e);
    return [];
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderCalendar(events) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  let activeOutsideClickHandler = null;

  function buildCalendar() {
    const el = document.getElementById("calendar");
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNames = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
    const weekdayNames = ["일","월","화","수","목","금","토"];

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
      <div class="cal-toolbar">
        <button class="cal-nav-btn" id="cal-prev">◀</button>
        <strong>${year}년 ${monthNames[month]}</strong>
        <button class="cal-nav-btn" id="cal-next">▶</button>
      </div>
      <div class="cal-grid">`;

    weekdayNames.forEach((wd, i) => {
      const cls = i === 0 ? " cal-sun" : i === 6 ? " cal-sat" : "";
      html += `<div class="cal-weekday${cls}">${wd}</div>`;
    });

    const totalCells = firstDay + daysInMonth;
    const totalRows = Math.ceil(totalCells / 7);

    let day = 1;
    for (let i = 0; i < totalRows * 7; i++) {
      const col = i % 7;
      if (i < firstDay || day > daysInMonth) {
        html += `<div class="cal-cell is-empty"></div>`;
      } else {
        const evts = monthEvents[day] || [];
        const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
        const cellClasses = ["cal-cell"];
        if (isToday) cellClasses.push("is-today");
        if (col === 0) cellClasses.push("is-sun");
        if (col === 6) cellClasses.push("is-sat");

        const shown = evts.slice(0, 2);
        const rest = evts.length - shown.length;
        let evtHtml = shown.map(e =>
          `<div class="cal-pill" onclick="location.href='/post/?id=${e.id}'">${e.title}</div>`
        ).join("");
        if (rest > 0) {
          evtHtml += `<div class="cal-more" data-day="${day}">+${rest}개</div>`;
        }

        html += `<div class="${cellClasses.join(" ")}" data-day="${day}"><span class="cal-day-num">${day}</span>${evtHtml}</div>`;
        day++;
      }
    }

    html += `</div>`;
    el.innerHTML = html;

    function removeActiveOutsideClickHandler() {
      if (activeOutsideClickHandler) {
        document.removeEventListener("click", activeOutsideClickHandler);
        activeOutsideClickHandler = null;
      }
    }
    function closePopover() {
      const existing = document.querySelector(".cal-popover");
      if (existing) existing.remove();
      removeActiveOutsideClickHandler();
    }
    function openPopover(cellEl, day) {
      closePopover();
      const evts = monthEvents[day] || [];
      if (!evts.length) return;
      const pop = document.createElement("div");
      pop.className = "cal-popover";
      pop.innerHTML = evts.map(e =>
        `<div class="cal-popover-item" onclick="location.href='/post/?id=${e.id}'">${escapeHtml(e.title)}</div>`
      ).join("");
      const rect = cellEl.getBoundingClientRect();
      const gridRect = el.querySelector(".cal-grid").getBoundingClientRect();
      pop.style.top = (rect.bottom - gridRect.top + 4) + "px";
      pop.style.left = (rect.left - gridRect.left) + "px";
      el.querySelector(".cal-grid").appendChild(pop);

      function onOutsideClick(ev) {
        if (!ev.target.closest(".cal-popover") && !ev.target.closest("[data-day]")) {
          closePopover();
        }
      }
      removeActiveOutsideClickHandler();
      activeOutsideClickHandler = onOutsideClick;
      document.addEventListener("click", activeOutsideClickHandler);
    }

    el.querySelectorAll(".cal-cell[data-day]").forEach(cell => {
      cell.addEventListener("click", (ev) => {
        if (ev.target.closest(".cal-pill")) return; // pill 클릭은 바로 이동, 팝오버 안 띄움
        ev.stopPropagation();
        openPopover(cell, cell.dataset.day);
      });
    });

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

function formatEventDate(ts) {
  if (!ts) return "";
  const d = ts.toDate();
  const date = d.toLocaleDateString("ko-KR");
  const h = d.getHours(), m = d.getMinutes();
  return (h || m) ? `${date} ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` : date;
}

function renderList(events) {
  const el = document.getElementById("event-list");
  el.innerHTML = "";
  if (!events.length) {
    el.innerHTML = `<tr><td colspan="3" class="text-muted">등록된 일정이 없습니다.</td></tr>`;
    return;
  }
  el.innerHTML = events.map(e => {
    const date = formatEventDate(e.eventDate);
    const cnt = e.attendees?.length || 0;
    const badge = cnt >= e.maxAttendees
      ? `<span class="badge-full">${cnt}/${e.maxAttendees} 마감</span>`
      : `<span class="badge-open">${cnt}/${e.maxAttendees}</span>`;
    return `<tr class="event-row" onclick="location.href='/post/?id=${e.id}'">
      <td>${date}</td><td>${e.title}</td><td>${badge}</td>
    </tr>`;
  }).join("");
}
