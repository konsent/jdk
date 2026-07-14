# 일정 캘린더 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `board.html`의 일정 캘린더를 표(`<table>`) 느낌의 고정 60px 셀 레이아웃에서, 반응형 CSS Grid 카드형 캘린더로 리디자인한다. 오늘/주말 강조, 이벤트 pill 축약(+N), 클릭 시 팝오버로 전체 일정 표시 기능을 추가한다.

**Architecture:** `assets/js/board.js`의 `renderCalendar()` / `buildCalendar()`를 `<table>` 생성에서 CSS Grid `<div>` 생성으로 교체한다. `assets/css/board.css`에 새 그리드/셀/팝오버 스타일을 추가하고 미사용 `.fc-*` 규칙을 제거한다. 의존성 추가 없음 — 순수 JS/CSS.

**Tech Stack:** Vanilla JS (ES module), Firebase Firestore (기존 `loadEvents()` 그대로), CSS Grid.

## Global Constraints

- 새 의존성(라이브러리) 추가 금지 — 순수 JS/CSS로 구현.
- 셀 높이 고정값(`height:60px` 등) 사용 금지 — `aspect-ratio` 기반 반응형 크기.
- 셀당 이벤트 미리보기는 최대 2개, 3개 이상이면 `+N개` 칩으로 축약.
- 팝오버는 클릭한 셀 바로 아래에 앵커링되는 드롭다운 형태 (화면 중앙 모달 아님).
- 팝오버 바깥 클릭 시 닫힘.
- 오늘 날짜, 토요일/일요일에 시각적 강조 적용.
- `board.css`의 미사용 `.fc-*` (FullCalendar 잔재) 규칙 삭제.
- 기존 이벤트 클릭 시 `/post/?id=` 이동 동작은 그대로 유지.
- 자동화 테스트 인프라 없음 — 각 태스크는 브라우저 수동 확인으로 검증.

---

## File Structure

- Modify: `assets/js/board.js` — `renderCalendar()` 내부의 `buildCalendar()`를 table 생성에서 grid 생성으로 교체, 팝오버 열기/닫기 로직 추가.
- Modify: `assets/css/board.css` — 미사용 `.fc-*` 규칙 삭제, 새 `.cal-*` 그리드/셀/팝오버 스타일 추가.
- No new files — 캘린더는 이 두 파일에만 의존하는 독립 컴포넌트이므로 파일 분리 불필요 (YAGNI).

---

## Task 1: 그리드 레이아웃 뼈대로 교체 (테이블 제거)

**Files:**
- Modify: `assets/js/board.js:59-130` (`renderCalendar` 함수 전체)
- Modify: `assets/css/board.css` (전체 — `.fc-*` 삭제, 그리드 스타일 추가)

**Interfaces:**
- Consumes: 기존 `events` 배열 (각 항목 `{id, title, eventDate: Firestore Timestamp, ...}`), `loadEvents()`의 반환값 그대로.
- Produces: `#calendar` 안에 `.cal-grid` (7열 CSS Grid) DOM 구조. 이후 태스크(2, 3)가 이 구조 위에 강조/pill/팝오버를 얹는다. 셀 DOM은 `<div class="cal-cell" data-day="N">` 형태이며 `data-day`는 이후 태스크가 팝오버 앵커링에 사용한다.

이 태스크는 순수 리팩터링(시각적 변화 최소, 구조만 grid로 전환)이라 테스트는 "레이아웃이 깨지지 않았는지" 수동 확인으로 대체한다. 자동화 단위 테스트가 없는 프로젝트이므로, 브라우저에서 직접 확인하는 것이 유일하고 적절한 검증 수단이다.

- [ ] **Step 1: `board.css`에서 미사용 FullCalendar 잔재 삭제**

`assets/css/board.css`에서 아래 4줄을 삭제한다 (파일 11~15번째 줄):

```css
.fc-event { cursor: pointer; border-radius: 4px !important; font-size: 0.78rem !important; }
.fc-toolbar-title { font-size: 1rem !important; font-weight: 700 !important; }
.fc-button { background: #1a1a1a !important; border-color: #1a1a1a !important; font-size: 0.8rem !important; padding: 5px 12px !important; border-radius: 5px !important; }
.fc-button:hover { background: #333 !important; border-color: #333 !important; }
.fc-button-active { background: #444 !important; border-color: #444 !important; }
```

- [ ] **Step 2: `board.css`에 그리드 레이아웃 스타일 추가**

`assets/css/board.css` 끝에 추가:

```css
.cal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.cal-toolbar strong { font-size: 1.05rem; font-weight: 700; color: #1a1a1a; }
.cal-nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #e8e8e4;
  background: #fff;
  color: #1a1a1a;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, border-color 0.12s;
}
.cal-nav-btn:hover { background: #f5f5f3; border-color: #d8d8d4; }

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  position: relative;
}
.cal-weekday {
  text-align: center;
  font-size: 0.78rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 8px 0;
  border-bottom: 1px solid #e8e8e4;
}
.cal-cell {
  aspect-ratio: 1 / 0.85;
  border-right: 1px solid #f0f0ee;
  border-bottom: 1px solid #f0f0ee;
  padding: 6px;
  overflow: hidden;
  position: relative;
  cursor: default;
}
.cal-cell.is-empty { cursor: default; }
.cal-grid .cal-cell:nth-child(7n) { border-right: none; }
.cal-day-num {
  font-size: 0.82rem;
  color: #1a1a1a;
  display: inline-block;
}
```

- [ ] **Step 3: `board.js`의 `renderCalendar` / `buildCalendar`를 grid 렌더링으로 교체**

`assets/js/board.js`의 59~130번째 줄 전체(`function renderCalendar(events) { ... }`)를 아래로 교체:

```javascript
function renderCalendar(events) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

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
      html += `<div class="cal-weekday">${wd}</div>`;
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
        html += `<div class="cal-cell" data-day="${day}"><span class="cal-day-num">${day}</span></div>`;
        day++;
      }
    }

    html += `</div>`;
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
```

이 단계에서는 아직 이벤트 pill, 오늘/주말 강조, 팝오버가 없다 — Task 2, 3에서 추가한다. `monthEvents`는 계산만 해두고 다음 태스크에서 사용한다.

- [ ] **Step 4: 브라우저에서 확인**

로컬 Jekyll 서버 실행 후 `/board/` 페이지 접속 (없다면 `bundle exec jekyll serve` 실행):

```bash
bundle exec jekyll serve
```

브라우저에서 `http://localhost:4000/board/` 접속해 확인:
- 캘린더가 표 테두리 없이 7열 그리드로 표시되는지
- 날짜 숫자가 각 칸 좌상단에 보이는지
- ◀▶ 버튼이 원형 아이콘 버튼으로 보이고 월 이동이 동작하는지
- 데스크톱 폭(1440px)에서 셀이 납작하지 않고 정사각형에 가까운지

- [ ] **Step 5: Commit**

```bash
git add assets/js/board.js assets/css/board.css
git commit -m "refactor: replace table-based calendar with CSS Grid layout"
```

---

## Task 2: 오늘/주말 강조 + 이벤트 pill (최대 2개 + N개 더보기)

**Files:**
- Modify: `assets/js/board.js` (`buildCalendar` 내부 셀 렌더링 부분)
- Modify: `assets/css/board.css` (강조/pill 스타일 추가)

**Interfaces:**
- Consumes: Task 1이 만든 `.cal-cell[data-day]` 구조, `monthEvents[day]` 배열.
- Produces: 각 셀에 `.is-today`, `.is-sat`, `.is-sun` 클래스; `.cal-pill` (이벤트 pill), `.cal-more` (+N 칩, `data-day` 속성 보유 — Task 3의 팝오버가 이 속성으로 어느 날짜인지 식별).

- [ ] **Step 1: `board.css`에 강조/pill 스타일 추가**

`assets/css/board.css` 끝에 추가:

```css
.cal-weekday.cal-sun { color: #c62828; }
.cal-weekday.cal-sat { color: #1565c0; }
.cal-cell.is-sun .cal-day-num { color: #c62828; }
.cal-cell.is-sat .cal-day-num { color: #1565c0; }
.cal-cell.is-today { background: #fff8e1; }
.cal-cell.is-today .cal-day-num {
  background: #1a1a1a;
  color: #fff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.76rem;
}

.cal-pill {
  margin-top: 3px;
  font-size: 0.68rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: #eef2ff;
  color: #3949ab;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.cal-pill:hover { background: #e0e6fb; }
.cal-more {
  margin-top: 3px;
  font-size: 0.68rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f0f0ee;
  color: #666;
  cursor: pointer;
  display: inline-block;
}
.cal-more:hover { background: #e5e5e1; }
```

- [ ] **Step 2: 셀 렌더링에 강조/pill 로직 추가**

`assets/js/board.js`의 `buildCalendar` 내부, Task 1에서 작성한 이 블록:

```javascript
      } else {
        const evts = monthEvents[day] || [];
        html += `<div class="cal-cell" data-day="${day}"><span class="cal-day-num">${day}</span></div>`;
        day++;
      }
```

를 아래로 교체:

```javascript
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
```

그리고 같은 함수 내 요일 헤더 생성 부분:

```javascript
    weekdayNames.forEach((wd, i) => {
      html += `<div class="cal-weekday">${wd}</div>`;
    });
```

를 아래로 교체 (일요일/토요일 색상 클래스 부여):

```javascript
    weekdayNames.forEach((wd, i) => {
      const cls = i === 0 ? " cal-sun" : i === 6 ? " cal-sat" : "";
      html += `<div class="cal-weekday${cls}">${wd}</div>`;
    });
```

- [ ] **Step 3: 브라우저에서 확인**

`/board/` 페이지 새로고침 후 확인:
- 오늘 날짜 칸에 노란빛 배경 + 날짜 숫자에 검정 원형 배지가 보이는지
- 일요일 열 헤더/날짜가 빨간색, 토요일 열이 파란색으로 보이는지
- 이벤트가 1개인 날은 pill 1개만, 3개 이상인 날은 pill 2개 + "+N개" 칩이 보이는지 (Firestore에 테스트 데이터가 부족하면 브라우저 콘솔에서 임시로 `monthEvents`에 목업을 넣어 확인하거나, `/write/`에서 같은 날짜로 이벤트 3개를 등록해 확인)

- [ ] **Step 4: Commit**

```bash
git add assets/js/board.js assets/css/board.css
git commit -m "feat: add today/weekend highlighting and event pill collapsing"
```

---

## Task 3: 팝오버 (셀/+N 클릭 시 전체 일정 드롭다운)

**Files:**
- Modify: `assets/js/board.js` (`renderCalendar` 함수 — 팝오버 열기/닫기 로직 추가)
- Modify: `assets/css/board.css` (팝오버 스타일 추가)

**Interfaces:**
- Consumes: Task 2의 `.cal-cell[data-day]`, `.cal-more[data-day]`, `monthEvents[day]`.
- Produces: 없음 (최종 사용자 기능, 이후 태스크 없음).

- [ ] **Step 1: `board.css`에 팝오버 스타일 추가**

`assets/css/board.css` 끝에 추가:

```css
.cal-popover {
  position: absolute;
  z-index: 20;
  background: #fff;
  border: 1px solid #e8e8e4;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  padding: 8px;
  min-width: 160px;
  max-width: 240px;
}
.cal-popover-item {
  font-size: 0.8rem;
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal-popover-item:hover { background: #f5f5f3; }
```

- [ ] **Step 2: 팝오버 열기/닫기 로직 추가**

`assets/js/board.js`의 `buildCalendar` 함수 안, `el.innerHTML = html;` 바로 다음 줄(현재 `document.getElementById("cal-prev")...` 이전)에 아래 코드를 삽입:

```javascript
    el.innerHTML = html;

    function closePopover() {
      const existing = document.querySelector(".cal-popover");
      if (existing) existing.remove();
      document.removeEventListener("click", onOutsideClick);
    }
    function onOutsideClick(ev) {
      if (!ev.target.closest(".cal-popover") && !ev.target.closest("[data-day]")) {
        closePopover();
      }
    }
    function openPopover(cellEl, day) {
      closePopover();
      const evts = monthEvents[day] || [];
      if (!evts.length) return;
      const pop = document.createElement("div");
      pop.className = "cal-popover";
      pop.innerHTML = evts.map(e =>
        `<div class="cal-popover-item" onclick="location.href='/post/?id=${e.id}'">${e.title}</div>`
      ).join("");
      const rect = cellEl.getBoundingClientRect();
      const gridRect = el.querySelector(".cal-grid").getBoundingClientRect();
      pop.style.top = (rect.bottom - gridRect.top + 4) + "px";
      pop.style.left = (rect.left - gridRect.left) + "px";
      el.querySelector(".cal-grid").appendChild(pop);
      setTimeout(() => document.addEventListener("click", onOutsideClick), 0);
    }

    el.querySelectorAll(".cal-cell[data-day]").forEach(cell => {
      cell.addEventListener("click", (ev) => {
        if (ev.target.closest(".cal-pill")) return; // pill 클릭은 바로 이동, 팝오버 안 띄움
        openPopover(cell, cell.dataset.day);
      });
    });
```

- [ ] **Step 3: 브라우저에서 확인**

`/board/` 페이지 새로고침 후 확인:
- 이벤트가 있는 날짜 칸(빈 공간 클릭 포함)을 클릭하면 칸 바로 아래에 팝오버가 뜨고 그 날의 전체 이벤트 제목이 보이는지
- "+N개" 칩을 클릭해도 같은 팝오버가 뜨는지
- 팝오버 항목 클릭 시 `/post/?id=...`로 이동하는지
- 팝오버가 열린 상태에서 바깥(다른 셀, 페이지 여백)을 클릭하면 닫히는지
- 이벤트가 없는 빈 날짜를 클릭했을 때 팝오버가 뜨지 않는지
- 월 이동 버튼 클릭 시 이전에 열려있던 팝오버가 사라지는지 (재렌더링으로 자동 제거됨)

- [ ] **Step 4: Commit**

```bash
git add assets/js/board.js assets/css/board.css
git commit -m "feat: add click-to-popover day view for calendar cells"
```

---

## Self-Review Notes

- **Spec coverage:** aspect-ratio 기반 셀(Task 1), 헤어라인 구분선(Task 1), 오늘/주말 강조(Task 2), pill 최대 2개+N개 축약(Task 2), 팝오버가 셀 바로 아래 드롭다운(Task 3), 원형 아이콘 이동 버튼(Task 1), `.fc-*` 삭제(Task 1) — 스펙의 모든 항목이 태스크로 매핑됨.
- **Placeholder scan:** 모든 스텝에 실제 코드 포함, TBD/TODO 없음.
- **Type/name consistency:** `monthEvents[day]` (배열), `.cal-cell[data-day]`, `.cal-more[data-day]` 네이밍이 Task 1→2→3에 걸쳐 동일하게 유지됨. `openPopover(cellEl, day)` / `closePopover()` 함수명도 Task 3 내에서 일관.
