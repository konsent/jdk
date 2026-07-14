import assert from "node:assert";
import { test } from "node:test";
import { TROPHIES_META } from "./trophies-meta.js";

test("TROPHIES_META: 5개 트로피, 각각 id/name/description/image 보유", () => {
  assert.strictEqual(TROPHIES_META.length, 5);
  TROPHIES_META.forEach((t) => {
    assert.ok(typeof t.id === "string" && t.id.length > 0);
    assert.ok(typeof t.name === "string" && t.name.length > 0);
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    assert.strictEqual(t.image, `/assets/trophies/${t.id}.png`);
  });
});

test("TROPHIES_META: id 목록이 functions/trophies.js와 동일하다", () => {
  const ids = TROPHIES_META.map((t) => t.id).sort();
  assert.deepStrictEqual(ids, [
    "full-house-king",
    "game-2048-champion",
    "kongz-regular",
    "kongz-veteran",
    "schedule-maker"
  ]);
});
