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
