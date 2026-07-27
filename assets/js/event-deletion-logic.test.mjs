import assert from "node:assert";
import { test } from "node:test";
import { nextEventPostCount, shouldAdjustEventPostCount } from "./event-deletion-logic.js";

test("nextEventPostCount: positive count decreases by one", () => {
  assert.strictEqual(nextEventPostCount(3), 2);
});

test("nextEventPostCount: zero never becomes negative", () => {
  assert.strictEqual(nextEventPostCount(0), 0);
});

test("nextEventPostCount: one decreases to zero", () => {
  assert.strictEqual(nextEventPostCount(1), 0);
});

test("nextEventPostCount: missing or invalid count becomes zero", () => {
  assert.strictEqual(nextEventPostCount(undefined), 0);
  assert.strictEqual(nextEventPostCount(-2), 0);
  assert.strictEqual(nextEventPostCount("3"), 0);
});

test("shouldAdjustEventPostCount: 창립기념일은 시스템 작성자여도 false", () => {
  assert.strictEqual(
    shouldAdjustEventPostCount({ type: "event", isAnniversary: true, authorUid: "system" }),
    false
  );
});

test("shouldAdjustEventPostCount: 일반 게임 일정은 true", () => {
  assert.strictEqual(shouldAdjustEventPostCount({ type: "event", authorUid: "u1" }), true);
});
