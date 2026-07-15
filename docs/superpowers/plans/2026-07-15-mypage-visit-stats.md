# 내 정보 페이지 방문 통계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mypage.html에 "아지트 방문 일수"와 "참여 게임 세션 수"를 표시한다.

**Architecture:** 순수 계산 로직을 `assets/js/mypage-logic.js`에 분리해 유닛 테스트로 검증하고, `assets/js/mypage.js`에서 Firestore `posts` 쿼리 결과를 이 로직에 넣어 실시간 계산한 뒤 `mypage.html`의 새 섹션에 렌더링한다. 저장 카운터 없음 — 매 페이지 로드 시 재계산.

**Tech Stack:** Vanilla JS (ES modules), Firebase Firestore v10 modular SDK, `node:test` for unit tests.

## Global Constraints

- 계산은 페이지 로드 시 실시간으로 수행하며, Firestore에 별도 카운터를 저장하지 않는다.
- "실제 참여" 판정: `type === "event" && !!closedAt && (confirmedAttendees || []).includes(uid)` — 기존 `functions/index.js`/`assets/js/stats.js`의 `filterConfirmedClosedEvents`와 동일한 조건.
- 아지트 방문 일수 = 참여 이벤트의 `eventDate`를 시분초 제거 후 날짜 단위로 dedupe한 개수.
- 참여 게임 세션 수 = 참여 이벤트 개수 (dedupe 없음).
- UI 배치: `#section-trophies` 바로 위, "내 평균 점수"와 동일한 라벨 스타일(`0.78rem` 굵은 회색 라벨 + 본문 텍스트).
- 표시 형식: 한 줄 텍스트, 예: `아지트 방문 일수 12일 · 참여 게임 세션 18회`
- 조회 실패 시 콘솔 에러만 남기고 페이지 렌더링은 계속 진행 (기존 rating stats 로딩과 동일한 try/catch 패턴).

---

### Task 1: 순수 계산 로직 (mypage-logic.js)

**Files:**
- Create: `assets/js/mypage-logic.js`
- Test: `assets/js/mypage-logic.test.mjs`

**Interfaces:**
- Consumes: 없음 (순수 함수, Firestore/DOM 의존 없음)
- Produces: `computeVisitStats(events, uid)` — `events`는 `posts` 문서 데이터 배열(`{type, closedAt, confirmedAttendees, eventDate}`), `eventDate`는 JS `Date` 또는 `{toDate(): Date}` 형태(Firestore Timestamp) 모두 허용. 반환값: `{ visitDays: number, participatedSessions: number }`. 이 함수는 Task 2(`mypage.js`)에서 그대로 호출된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`assets/js/mypage-logic.test.mjs`:

```js
import assert from "node:assert";
import { test } from "node:test";
import { computeVisitStats } from "./mypage-logic.js";

function ts(dateStr) {
  const d = new Date(dateStr);
  return { toDate: () => d };
}

test("computeVisitStats: 참여 이벤트가 없으면 0/0", () => {
  assert.deepStrictEqual(computeVisitStats([], "u1"), { visitDays: 0, participatedSessions: 0 });
});

test("computeVisitStats: closedAt 없는 이벤트는 제외", () => {
  const events = [
    { type: "event", closedAt: null, confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 0, participatedSessions: 0 });
});

test("computeVisitStats: confirmedAttendees에 uid 없으면 제외 (노쇼)", () => {
  const events = [
    { type: "event", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u2"], eventDate: ts("2026-07-01T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 0, participatedSessions: 0 });
});

test("computeVisitStats: type이 event가 아니면 제외", () => {
  const events = [
    { type: "notice", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 0, participatedSessions: 0 });
});

test("computeVisitStats: 같은 날 2개 세션 참여 시 방문일수 1, 세션수 2", () => {
  const events = [
    { type: "event", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T10:00:00") },
    { type: "event", closedAt: ts("2026-07-01T21:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T18:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 1, participatedSessions: 2 });
});

test("computeVisitStats: 다른 날 참여는 각각 별도 방문일로 계산", () => {
  const events = [
    { type: "event", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T10:00:00") },
    { type: "event", closedAt: ts("2026-07-02T20:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-02T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 2, participatedSessions: 2 });
});

test("computeVisitStats: eventDate가 순수 Date 객체여도 동작", () => {
  const events = [
    { type: "event", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u1"], eventDate: new Date("2026-07-01T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 1, participatedSessions: 1 });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test assets/js/mypage-logic.test.mjs`
Expected: FAIL — `Cannot find module './mypage-logic.js'`

- [ ] **Step 3: 최소 구현 작성**

`assets/js/mypage-logic.js`:

```js
function toDateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

function toDayKey(date) {
  const dt = new Date(date);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

export function computeVisitStats(events, uid) {
  const confirmedEvents = events.filter(
    (p) => p.type === "event" && !!p.closedAt && (p.confirmedAttendees || []).includes(uid)
  );

  const participatedSessions = confirmedEvents.length;

  const dayKeys = new Set(
    confirmedEvents
      .map((p) => toDateOrNull(p.eventDate))
      .filter((d) => d instanceof Date)
      .map(toDayKey)
  );

  return { visitDays: dayKeys.size, participatedSessions };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test assets/js/mypage-logic.test.mjs`
Expected: PASS, `# tests 7`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add assets/js/mypage-logic.js assets/js/mypage-logic.test.mjs
git commit -m "feat: add pure visit-stats calculation for mypage"
```

---

### Task 2: mypage.js에 통계 조회/렌더링 연결

**Files:**
- Modify: `assets/js/mypage.js`
- Modify: `mypage.html`

**Interfaces:**
- Consumes: `computeVisitStats(events, uid)` from Task 1 (`assets/js/mypage-logic.js`), returns `{ visitDays, participatedSessions }`.
- Produces: 없음 (최종 UI 연결, 이후 태스크 없음)

- [ ] **Step 1: mypage.html에 새 섹션 추가**

`mypage.html`의 `#section-trophies` 바로 위에 삽입 (현재 82번째 줄 `<div id="section-trophies" class="mb-4">` 앞):

```html
      <div id="section-visit-stats" class="mb-4">
        <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:4px">활동 기록</div>
        <div id="visit-stats-text" style="font-size:0.92rem;color:var(--text-secondary)"></div>
      </div>

```

- [ ] **Step 2: mypage.js에 import 추가**

`assets/js/mypage.js` 최상단 import 블록(현재 1~10번째 줄)에 추가:

```js
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { computeVisitStats } from "./mypage-logic.js";
```

기존 `doc, deleteDoc, getDoc, updateDoc` import 줄(현재 4~6번째 줄)과 합쳐도 되지만, 별도 줄로 추가해도 무방.

- [ ] **Step 3: 통계 조회/렌더링 함수 추가 및 호출**

`assets/js/mypage.js`의 기존 rating stats try/catch 블록(현재 37~52번째 줄, `computeAverages` 호출 부분) 바로 뒤, `await setupParties(user);` 호출 전에 추가:

```js
  await renderVisitStats(user);
```

파일 하단에 (예: `showError` 함수 뒤, 96~99번째 줄 부근) 새 함수 추가:

```js
async function renderVisitStats(user) {
  const el = document.getElementById("visit-stats-text");
  try {
    const q = query(
      collection(db, "posts"),
      where("type", "==", "event"),
      where("confirmedAttendees", "array-contains", user.uid)
    );
    const snap = await getDocs(q);
    const events = snap.docs.map((d) => d.data());
    const { visitDays, participatedSessions } = computeVisitStats(events, user.uid);
    el.textContent = `아지트 방문 일수 ${visitDays}일 · 참여 게임 세션 ${participatedSessions}회`;
  } catch (e) {
    console.error("방문 통계 로드 실패", e);
    el.textContent = "";
  }
}
```

- [ ] **Step 4: 수동 확인**

Run: 로컬 Jekyll 서버 기동 후 로그인한 계정으로 `/mypage/` 접속 (또는 기존 로컬 개발 서버 실행 방법 사용).
Expected: "활동 기록" 라벨 아래 "아지트 방문 일수 N일 · 참여 게임 세션 M회" 텍스트가 표시되고, 콘솔에 에러가 없다. 참여 이력이 있는 테스트 계정으로 확인해 N, M이 실제 확정 참여 이력과 일치하는지 확인.

- [ ] **Step 5: 유닛 테스트 전체 재확인**

Run: `node --test assets/js/*.test.mjs`
Expected: 기존 테스트 전부 PASS, Task 1의 `mypage-logic.test.mjs` 포함.

- [ ] **Step 6: 커밋**

```bash
git add assets/js/mypage.js mypage.html
git commit -m "feat: show visit-day and session-count stats on mypage"
```

---

## Self-Review Notes

- **Spec coverage:** 계산 로직(실시간, 저장 카운터 없음) → Task 1+2. UI 배치(트로피 섹션 위) → Task 2 Step 1. 표시 형식(한 줄 텍스트) → Task 2 Step 3. 에러 처리(try/catch, 콘솔 에러만) → Task 2 Step 3. 모두 커버됨.
- **Placeholder scan:** 없음 — 모든 스텝에 실제 코드/명령어 포함.
- **Type consistency:** `computeVisitStats(events, uid)` 시그니처와 반환 타입 `{visitDays, participatedSessions}`이 Task 1, Task 2에서 동일하게 사용됨.
