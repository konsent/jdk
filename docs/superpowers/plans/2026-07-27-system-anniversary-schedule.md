# 시스템 창립기념일 일정 자동 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시스템이 매년 5월 23일에 참가 가능한 장단콩 클럽 기념일 게임 일정을 자동 생성하고, 게시판에 시스템 작성자로 표시한다.

**Architecture:** Cloud Scheduler가 매일 자정(Asia/Seoul)에 Firestore의 고정 문서 ID를 확인해, 5월 23일 이후 누락된 해당 연도 일정만 생성한다. 클라이언트는 기념일 일정을 일반 일정처럼 표시하되, 통계 재계산과 삭제는 `isAnniversary`를 기준으로 작성자 등록 횟수만 제외한다.

**Tech Stack:** Firebase Functions v2 Scheduler, Firebase Admin Firestore, Firebase Web SDK, Node.js built-in test runner, ES modules.

## Global Constraints

- 일정 생성 시각은 `Asia/Seoul` 기준 매일 00:00이고, 5월 23일 이후에만 생성한다.
- 문서 ID는 `anniversary-YYYY`이며 같은 연도에 중복 생성하지 않는다.
- 제목은 `장단콩 클럽 N주년 기념일 🎉`, `N = YYYY - 2023`이며 본문은 빈 문자열이다.
- 자동 일정은 `authorUid: "system"`, `authorName: "시스템"`, `maxAttendees: 20`, 빈 `attendees`/`games`를 가진 `event` 문서다.
- 자동 일정의 `eventDate`는 해당 연도 5월 23일 23:59(`Asia/Seoul`)로 저장해, 당일 내내 참가 신청을 받는다.
- 자동 일정은 게시판에서 표시되고 참가 신청을 받는다.
- `isAnniversary === true`는 작성자 `postCount`와 등록 횟수 기반 트로피에서 제외하지만 참석자 `attendCount`는 유지한다.

---

## File Structure

- Create: `functions/anniversary.js` — 날짜 판정, 문서 ID, 제목, Firestore에 저장할 자동 일정의 순수 데이터 생성.
- Create: `functions/anniversary.test.js` — 스케줄 생성 규칙과 데이터 계약 테스트.
- Modify: `functions/index.js` — Scheduler 함수 등록 및 Firestore 트랜잭션으로 멱등 생성.
- Modify: `assets/js/board.js` — 모든 이벤트를 게시판 표시용 순수 함수로 전달.
- Create: `assets/js/board-logic.js` — 게시판 표시 이벤트 선별 함수.
- Create: `assets/js/board-logic.test.mjs` — 기념일 일정이 게시판에 남는 회귀 테스트.
- Modify: `assets/js/post.js` — 시스템 작성자 표시와 기념일 삭제의 postCount 제외.
- Modify: `assets/js/event-deletion-logic.js` — 삭제 시 등록 횟수 조정 여부의 순수 판정.
- Modify: `assets/js/event-deletion-logic.test.mjs` — 기념일 삭제 시 등록 횟수 미조정 테스트.
- Modify: `assets/js/stats.js` — 재계산 시 기념일 작성자 postCount 제외, 참석자 attendCount 유지.

### Task 1: 자동 생성 규칙과 Cloud Scheduler

**Files:**
- Create: `functions/anniversary.js`
- Create: `functions/anniversary.test.js`
- Modify: `functions/index.js:1-8, after BGG function exports`

**Interfaces:**
- Produces: `getSeoulDateParts(now): { year: number, month: number, day: number }`
- Produces: `shouldCreateAnniversary(parts): boolean`
- Produces: `anniversaryPostId(year): string`
- Produces: `buildAnniversaryPost(year, eventDate): object`
- Consumes: `buildAnniversaryPost(year, Timestamp.fromDate(...))` from `functions/index.js`.

- [ ] **Step 1: Write failing unit tests for date gating and event payload**

```js
const { test } = require("node:test");
const assert = require("node:assert");
const { shouldCreateAnniversary, anniversaryPostId, buildAnniversaryPost } = require("./anniversary.js");

test("shouldCreateAnniversary: 5월 22일 전에는 false이고 5월 23일부터 true", () => {
  assert.strictEqual(shouldCreateAnniversary({ year: 2026, month: 5, day: 22 }), false);
  assert.strictEqual(shouldCreateAnniversary({ year: 2026, month: 5, day: 23 }), true);
  assert.strictEqual(shouldCreateAnniversary({ year: 2026, month: 7, day: 27 }), true);
});

test("buildAnniversaryPost: 시스템 작성자·20명 정원·3주년 제목을 만든다", () => {
  const eventDate = new Date("2026-05-22T15:00:00.000Z");
  assert.deepStrictEqual(buildAnniversaryPost(2026, eventDate), {
    type: "event", isAnniversary: true, authorUid: "system", authorName: "시스템",
    title: "장단콩 클럽 3주년 기념일 🎉", content: "", eventDate,
    maxAttendees: 20, attendees: [], games: []
  });
  assert.strictEqual(anniversaryPostId(2026), "anniversary-2026");
});
```

- [ ] **Step 2: Verify the tests fail because the module does not exist**

Run: `node --test functions/anniversary.test.js`

Expected: FAIL with `Cannot find module './anniversary.js'`.

- [ ] **Step 3: Implement the pure scheduling helpers**

```js
const FOUNDATION_YEAR = 2023;
const ANNIVERSARY_MONTH = 5;
const ANNIVERSARY_DAY = 23;

function shouldCreateAnniversary({ month, day }) {
  return month > ANNIVERSARY_MONTH || (month === ANNIVERSARY_MONTH && day >= ANNIVERSARY_DAY);
}

function anniversaryPostId(year) { return `anniversary-${year}`; }

function buildAnniversaryPost(year, eventDate) {
  return {
    type: "event", isAnniversary: true, authorUid: "system", authorName: "시스템",
    title: `장단콩 클럽 ${year - FOUNDATION_YEAR}주년 기념일 🎉`, content: "", eventDate,
    maxAttendees: 20, attendees: [], games: []
  };
}
```

Implement `getSeoulDateParts` with `Intl.DateTimeFormat(..., { timeZone: "Asia/Seoul" }).formatToParts(now)`; it must return numeric `year`, `month`, and `day` values.

- [ ] **Step 4: Verify the helper tests pass**

Run: `node --test functions/anniversary.test.js`

Expected: PASS with 2 tests.

- [ ] **Step 5: Register the idempotent Scheduler function**

Import `onSchedule` from `firebase-functions/v2/scheduler`, `Timestamp` from `firebase-admin/firestore`, and helpers from `./anniversary.js`. Add this function to `functions/index.js`:

```js
exports.ensureAnniversarySchedule = onSchedule(
  { schedule: "0 0 * * *", timeZone: "Asia/Seoul" },
  async () => {
    const parts = getSeoulDateParts(new Date());
    if (!shouldCreateAnniversary(parts)) return;
    const db = getFirestore();
    const ref = db.collection("posts").doc(anniversaryPostId(parts.year));
    const eventDate = Timestamp.fromDate(new Date(Date.UTC(parts.year, 4, 23, 14, 59)));
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, {
        ...buildAnniversaryPost(parts.year, eventDate),
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      });
    });
  }
);
```

- [ ] **Step 6: Run all Cloud Functions tests**

Run: `cd functions && node --test *.test.js`

Expected: PASS with no failing test.

- [ ] **Step 7: Commit the scheduler work**

```bash
git add functions/index.js functions/anniversary.js functions/anniversary.test.js
git commit -m "feat: schedule anniversary event creation"
```

### Task 2: 표시와 시스템 작성자 처리

**Files:**
- Create: `assets/js/board-logic.js`
- Create: `assets/js/board-logic.test.mjs`
- Modify: `assets/js/board.js:1-55`
- Modify: `assets/js/post.js:87-100`

**Interfaces:**
- Produces: `displayEvents(events): object[]`, preserving every event including `isAnniversary === true`.
- Consumes: `authorName?: string` from an automated post.

- [ ] **Step 1: Write the failing calendar regression test**

```js
import assert from "node:assert";
import { test } from "node:test";
import { displayEvents } from "./board-logic.js";

test("displayEvents: 창립기념일 일정을 게시판에 포함한다", () => {
  const anniversary = { id: "anniversary-2026", type: "event", isAnniversary: true };
  assert.deepStrictEqual(displayEvents([anniversary]), [anniversary]);
});
```

- [ ] **Step 2: Verify it fails under the old anniversary filter**

Run: `node --test assets/js/board-logic.test.mjs`

Expected: FAIL because the old implementation excludes `isAnniversary`.

- [ ] **Step 3: Implement and use the display selector**

```js
// assets/js/board-logic.js
export function displayEvents(events) { return events; }

// assets/js/board.js
import { displayEvents } from "./board-logic.js";
const events = displayEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
```

Do not filter on `isAnniversary` in `loadEvents`.

- [ ] **Step 4: Render the stored system name on post detail**

Replace author resolution with:

```js
const authorDoc = await getUserDoc(postData.authorUid);
const authorName = postData.authorName || authorDoc?.nickname || "알 수 없음";
```

This preserves ordinary user posts while rendering automatic posts as `시스템`.

- [ ] **Step 5: Verify the browser-side tests pass**

Run: `node --test assets/js/*.test.mjs`

Expected: PASS with the new calendar test and all existing tests.

- [ ] **Step 6: Commit the display work**

```bash
git add assets/js/board.js assets/js/board-logic.js assets/js/board-logic.test.mjs assets/js/post.js
git commit -m "feat: show system anniversary events"
```

### Task 3: Exclude only registration counts from anniversary statistics

**Files:**
- Modify: `assets/js/event-deletion-logic.js`
- Modify: `assets/js/event-deletion-logic.test.mjs`
- Modify: `assets/js/post.js:57-76`
- Modify: `assets/js/stats.js:389-407`

**Interfaces:**
- Produces: `shouldAdjustEventPostCount(post): boolean` returning true only for non-anniversary event posts with an `authorUid`.
- Consumes: `post.isAnniversary` in deletion and administrative stats rebuild.

- [ ] **Step 1: Write failing deletion decision tests**

```js
import { shouldAdjustEventPostCount } from "./event-deletion-logic.js";

test("shouldAdjustEventPostCount: 창립기념일은 시스템 작성자여도 false", () => {
  assert.strictEqual(
    shouldAdjustEventPostCount({ type: "event", isAnniversary: true, authorUid: "system" }),
    false
  );
});

test("shouldAdjustEventPostCount: 일반 게임 일정은 true", () => {
  assert.strictEqual(shouldAdjustEventPostCount({ type: "event", authorUid: "u1" }), true);
});
```

- [ ] **Step 2: Verify the new test fails**

Run: `node --test assets/js/event-deletion-logic.test.mjs`

Expected: FAIL because `shouldAdjustEventPostCount` is not exported.

- [ ] **Step 3: Implement the decision helper and use it in the deletion transaction**

```js
export function shouldAdjustEventPostCount(post) {
  return post?.type === "event" && post.isAnniversary !== true && !!post.authorUid;
}
```

In `deletePostWithEventStats`, replace the event/author condition with `shouldAdjustEventPostCount(latestPost)`.

- [ ] **Step 4: Keep attendee totals when rebuilding stats**

Replace the rebuild loop body with logic that increments the author only when `!post.isAnniversary`, then always iterates `(post.attendees || [])` to increment each attendee's `attendCount`. Initialize `rebuilt[uid]` with `{ nickname: nicknameMap[uid] || "", attendCount: 0, postCount: 0 }` before every increment.

- [ ] **Step 5: Verify deletion and browser-side tests pass**

Run: `node --test assets/js/event-deletion-logic.test.mjs && node --test assets/js/*.test.mjs`

Expected: PASS; the anniversary case leaves postCount untouched.

- [ ] **Step 6: Commit the statistics work**

```bash
git add assets/js/event-deletion-logic.js assets/js/event-deletion-logic.test.mjs assets/js/post.js assets/js/stats.js
git commit -m "fix: exclude anniversary events from post counts"
```

### Task 4: Full verification and release

**Files:**
- Verify only: files changed in Tasks 1-3

**Interfaces:**
- Verifies: scheduler helper contract, board display contract, author display fallback, and registration-count exclusion contract.

- [ ] **Step 1: Run the complete automated suite**

Run: `cd functions && node --test *.test.js && cd .. && node --test assets/js/*.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 2: Check changed files and whitespace**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the intended files are modified or staged.

- [ ] **Step 3: Deploy Cloud Functions and static site after explicit release approval**

Run: `firebase deploy --only functions` followed by the repository's normal GitHub Pages publish workflow.

Expected: Scheduler deployment reports `ensureAnniversarySchedule` with `Asia/Seoul`; the deployed board script no longer filters `isAnniversary`.

- [ ] **Step 4: Verify the deployed behavior**

Open `/board/`, navigate to May of the current year, and confirm the `장단콩 클럽 N주년 기념일 🎉` row appears. Open its detail page to confirm `시스템`, empty body, 20-person capacity, and a visible participant sign-up action.
