# 자동 트로피 수여 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일정 마감과 참석 확정의 순서에 관계없이 모든 실제 참석 기반 트로피를 자동 수여한다.

**Architecture:** `posts/{postId}` 트리거가 참석자 변경 또는 이벤트 마감을 감지해, 마감된 이벤트의 확정 참석자 uid를 중복 없이 다시 판정한다. 기존 `awardTrophies`로 신규 업적만 추가한다.

**Tech Stack:** Firebase Cloud Functions v2, Firestore, Node `node:test`.

## Global Constraints

- 트로피는 영구 보존하며 기존 수상자를 회수하지 않는다.
- 마감된 이벤트의 `confirmedAttendees`만 실제 참석으로 집계한다.
- 동일 uid는 한 이벤트 쓰기에서 한 번만 판정한다.
- 기존 `awardTrophies`와 `newlyEarnedTrophyIds`로 중복 기록을 막는다.

### Task 1: 마감·확정 순서 독립적인 참석 트리거

**Files:**
- Modify: `functions/index.js:365-435`
- Modify: `functions/index.test.js`

**Interfaces:**
- Produces: `trophyEligibleConfirmedUids(beforeData, afterData) => string[]`, 마감된 이벤트에서 확정 변경 또는 마감 변경으로 재판정해야 할 uid 목록.

- [ ] **Step 1: Write failing tests**

```js
const { trophyEligibleConfirmedUids } = require("./index.js");

test("trophyEligibleConfirmedUids: 마감 전 확정은 제외하고 마감 시 확정 참석자를 반환한다", () => {
  const before = { type: "event", confirmedAttendees: ["u1"] };
  const after = { type: "event", confirmedAttendees: ["u1"], closedAt: new Date() };
  assert.deepStrictEqual(trophyEligibleConfirmedUids(before, after), ["u1"]);
});

test("trophyEligibleConfirmedUids: 마감 후 참석 확정 시 변경된 전체 확정 참석자를 반환한다", () => {
  const before = { type: "event", closedAt: new Date(), confirmedAttendees: ["u1"] };
  const after = { type: "event", closedAt: new Date(), confirmedAttendees: ["u1", "u2", "u2"] };
  assert.deepStrictEqual(trophyEligibleConfirmedUids(before, after), ["u1", "u2"]);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test functions/index.test.js`

Expected: FAIL because `trophyEligibleConfirmedUids` is not exported.

- [ ] **Step 3: Implement and wire the helper**

```js
function trophyEligibleConfirmedUids(beforeData, afterData) {
  if (!afterData || afterData.type !== "event" || !afterData.closedAt) return [];
  const attendeesChanged = confirmedAttendeesChanged(beforeData, afterData);
  const justClosed = becamePostClosed(beforeData, afterData);
  if (!attendeesChanged && !justClosed) return [];
  return [...new Set(afterData.confirmedAttendees || [])];
}
```

Export the helper. Make `onPostConfirmed` use its result and return when empty; retain its existing Firestore query, candidate calculation, and `awardTrophies` call. This replaces the separate early return based only on `confirmedAttendeesChanged`.

- [ ] **Step 4: Verify green**

Run: `node --test functions/index.test.js functions/trophies.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "fix: award attendance trophies when events close"
```

### Task 2: 배포와 누락 복구

- [ ] **Step 1: Run full tests**

Run: `node --test functions/*.test.js && node --test assets/js/*.test.mjs`

- [ ] **Step 2: Deploy the changed trigger**

Run: `firebase deploy --only functions:onPostConfirmed`

- [ ] **Step 3: Run existing administrator trophy backfill once**

Open `/stats/` as administrator and select “트로피 소급 재계산”; confirm the result includes no failed users.
