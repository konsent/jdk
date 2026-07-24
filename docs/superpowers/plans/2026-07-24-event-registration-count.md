# Event Registration Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure deleting a game-event post atomically removes its registration count from the author's statistics, and reset only the existing "다소" member's registration count to zero.

**Architecture:** Extract the pure, boundary-safe `postCount` decrement into a small logic module with Node tests. In the post page, replace direct deletion with a Firestore transaction that re-reads the post, conditionally updates `stats/global`, then deletes the post. The historical correction is a one-time Firestore Console edit to one nested field after identifying the exact user UID.

**Tech Stack:** Browser ES modules, Firebase Firestore v10.12.2 transactions, Node built-in `node:test` and `node:assert`.

## Global Constraints

- Only posts with `type === "event"` change `members.<authorUid>.postCount`.
- The count must never be written below `0`.
- The event-stat update and post deletion must succeed or fail together.
- The one-time "다소" correction changes only `members.<dasoUid>.postCount`; attendance, ratings, and every other member field remain intact.
- Do not add dependencies or a permanent admin UI for this one-time correction.

---

## File structure

- Create: `assets/js/event-deletion-logic.js` — pure calculation for the next registration count.
- Create: `assets/js/event-deletion-logic.test.mjs` — Node tests for valid, missing, zero, and invalid current counts.
- Modify: `assets/js/post.js:1-11,118-123` — use the pure calculation inside a Firestore transaction for post deletion.
- Operational data change: Firestore Console documents `users/<dasoUid>` and `stats/global` — reset one approved field after exact UID verification.

### Task 1: Add and verify the safe count-decrement calculation

**Files:**

- Create: `assets/js/event-deletion-logic.js`
- Create: `assets/js/event-deletion-logic.test.mjs`

**Interfaces:**

- Consumes: `currentPostCount: unknown` from `stats/global.members.<authorUid>.postCount`.
- Produces: `nextEventPostCount(currentPostCount): number`, an integer that is never below zero.

- [ ] **Step 1: Write the failing test**

Create `assets/js/event-deletion-logic.test.mjs` with:

```js
import assert from "node:assert";
import { test } from "node:test";
import { nextEventPostCount } from "./event-deletion-logic.js";

test("nextEventPostCount: positive count decreases by one", () => {
  assert.strictEqual(nextEventPostCount(3), 2);
});

test("nextEventPostCount: zero never becomes negative", () => {
  assert.strictEqual(nextEventPostCount(0), 0);
});

test("nextEventPostCount: missing or invalid count becomes zero", () => {
  assert.strictEqual(nextEventPostCount(undefined), 0);
  assert.strictEqual(nextEventPostCount(-2), 0);
  assert.strictEqual(nextEventPostCount("3"), 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test assets/js/event-deletion-logic.test.mjs`

Expected: FAIL because `assets/js/event-deletion-logic.js` does not yet exist.

- [ ] **Step 3: Write the minimal implementation**

Create `assets/js/event-deletion-logic.js` with:

```js
export function nextEventPostCount(currentPostCount) {
  if (!Number.isInteger(currentPostCount) || currentPostCount <= 0) return 0;
  return currentPostCount - 1;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test assets/js/event-deletion-logic.test.mjs`

Expected: PASS with 3 passing subtests and 0 failures.

- [ ] **Step 5: Commit the independently tested logic**

```bash
git add assets/js/event-deletion-logic.js assets/js/event-deletion-logic.test.mjs
git commit -m "test: cover event registration count decrement"
```

### Task 2: Make event deletion and its statistic update atomic

**Files:**

- Modify: `assets/js/post.js:1-11`
- Modify: `assets/js/post.js:118-123`
- Test: `assets/js/event-deletion-logic.test.mjs`

**Interfaces:**

- Consumes: `nextEventPostCount(currentPostCount)` from `assets/js/event-deletion-logic.js`; the existing Firestore `runTransaction`, `doc`, and `serverTimestamp` imports.
- Produces: `deletePostWithEventStats()` inside `assets/js/post.js`, which deletes the latest post and only decrements the latest event author's count.

- [ ] **Step 1: Extend the test for the one-to-zero boundary**

Add this test to `assets/js/event-deletion-logic.test.mjs`:

```js
test("nextEventPostCount: one decreases to zero", () => {
  assert.strictEqual(nextEventPostCount(1), 0);
});
```

- [ ] **Step 2: Run the focused test**

Run: `node --test assets/js/event-deletion-logic.test.mjs`

Expected: PASS with 4 passing subtests and 0 failures.

- [ ] **Step 3: Import the calculator and add the transaction helper**

Below the existing imports in `assets/js/post.js`, add:

```js
import { nextEventPostCount } from "./event-deletion-logic.js";
```

Above `loadPost()`, add:

```js
async function deletePostWithEventStats() {
  const postRef = doc(db, "posts", postId);
  const statsRef = doc(db, "stats", "global");

  await runTransaction(db, async (tx) => {
    const latestPostSnap = await tx.get(postRef);
    if (!latestPostSnap.exists()) throw new Error("게시글을 찾을 수 없습니다.");

    const latestPost = latestPostSnap.data();
    if (latestPost.type === "event" && latestPost.authorUid) {
      const statsSnap = await tx.get(statsRef);
      const currentPostCount = statsSnap.data()?.members?.[latestPost.authorUid]?.postCount;
      tx.set(statsRef, {
        updatedAt: serverTimestamp(),
        [`members.${latestPost.authorUid}.postCount`]: nextEventPostCount(currentPostCount)
      }, { merge: true });
    }

    tx.delete(postRef);
  });
}
```

The transaction reads all required documents before it writes. It uses the latest stored post, so a stale page cannot decrement a notice or a changed author incorrectly. `tx.set(..., { merge: true })` writes only the required nested field if the stats document or member entry was missing.

- [ ] **Step 4: Replace direct deletion and surface failures**

Replace the existing delete-button handler body:

```js
if (!confirm("게시글을 삭제하시겠습니까?")) return;
await deleteDoc(doc(db, "posts", postId));
location.href = "/board/";
```

with:

```js
if (!confirm("게시글을 삭제하시겠습니까?")) return;
try {
  await deletePostWithEventStats();
  location.href = "/board/";
} catch (e) {
  console.error("post deletion failed", e);
  alert("게시글 삭제 중 오류가 발생했습니다. 다시 시도해주세요.");
}
```

Keep the existing `deleteDoc` import because comment deletion later in the same file still uses it.

- [ ] **Step 5: Run static and unit verification**

Run: `node --check assets/js/post.js && node --check assets/js/event-deletion-logic.js && node --test assets/js/event-deletion-logic.test.mjs`

Expected: both syntax checks exit with code 0; the test runner reports 4 passing subtests and 0 failures.

- [ ] **Step 6: Manually verify the transaction in the authenticated app**

1. As an authorized event author or administrator, record a test author's `stats/global.members.<uid>.postCount` as `N`.
2. Delete a test event from `/post/?id=<eventId>`.
3. Confirm the event document is absent and `postCount` is `max(N - 1, 0)`.
4. Create and delete a test notice, then confirm the same author's `postCount` is unchanged.
5. Attempt an event deletion while the browser is offline; confirm the error is shown and, after reconnecting, both the event and count remain unchanged until a successful retry.

- [ ] **Step 7: Commit the atomic deletion behavior**

```bash
git add assets/js/post.js assets/js/event-deletion-logic.js assets/js/event-deletion-logic.test.mjs
git commit -m "fix: decrement event registration count on deletion"
```

### Task 3: Perform the approved one-time "다소" correction

**Files:**

- Modify: Firestore document `stats/global` only.
- Verify: Firestore document `users/<dasoUid>` and unchanged sibling fields in `stats/global.members.<dasoUid>`.

**Interfaces:**

- Consumes: the exact UID of the single `users` document with `nickname` exactly `다소`.
- Produces: `stats/global.members.<dasoUid>.postCount === 0` without changes to other nested member statistics.

- [ ] **Step 1: Identify the exact user document**

In Firebase Console → Firestore Database → `users`, find the document whose `nickname` field is exactly `다소`. Copy its document ID as `<dasoUid>`. Confirm the nickname in that document; do not infer the UID from a display label or email.

- [ ] **Step 2: Record fields that must remain intact**

In Firebase Console → Firestore Database → `stats` → `global` → `members` → `<dasoUid>`, record the current `nickname`, `attendCount`, `ratingCount`, and `ratingSum` values if present.

- [ ] **Step 3: Set only the registration count to zero**

Edit only `postCount` in that member map and set its numeric value to `0`. Save the document. Do not use the stats rebuild action: it would alter other members and recompute rather than explicitly reset this user's count.

- [ ] **Step 4: Verify the scoped data correction**

Refresh `stats/global`. Confirm `members.<dasoUid>.postCount` is numeric `0` and the fields recorded in Step 2 are unchanged. Refresh `/stats/` as an administrator and verify the 일정 등록 랭킹 no longer counts the historical value for 다소.

- [ ] **Step 5: Record the data operation in the handoff**

Include the exact verified UID only in a private deployment/change log if one exists; do not commit personal account identifiers to this public repository. Report that the scoped Firestore correction completed and only `postCount` changed.

## Plan self-review

- Spec coverage: Task 2 implements event-only atomic decrement, re-reads the live post, protects against negative counts, and surfaces failures. Task 1 supplies the unit-tested boundary calculation. Task 3 resets only 다소's `postCount` and verifies unrelated fields remain unchanged.
- Placeholder scan: no unresolved markers, unspecified tests, or unnamed interfaces remain.
- Type consistency: `nextEventPostCount` is exported from `event-deletion-logic.js`, imported under the same name in `post.js`, and accepts the unknown Firestore field value used by the transaction.
