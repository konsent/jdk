import assert from "node:assert";
import { test } from "node:test";
import { TROPHIES_META } from "./trophies-meta.js";

test("TROPHIES_META: 각 트로피가 id/name/description/image를 보유", () => {
  assert.strictEqual(TROPHIES_META.length, 18);
  TROPHIES_META.forEach((t) => {
    assert.ok(typeof t.id === "string" && t.id.length > 0);
    assert.ok(typeof t.name === "string" && t.name.length > 0);
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    assert.strictEqual(t.image, `/assets/trophy/${t.id}.png`);
  });
});

test("TROPHIES_META: 18개 트로피, id 목록이 functions/trophies.js와 동일하다", () => {
  assert.strictEqual(TROPHIES_META.length, 18);
  const ids = TROPHIES_META.map((t) => t.id).sort();
  assert.deepStrictEqual(ids, [
    "annual-member",
    "five-day-streak",
    "full-house-king",
    "game-2048-champion",
    "heartthrob",
    "kongz-hot",
    "kongz-regular",
    "kongz-veteran",
    "no-noshow-20",
    "paju-ghost-1",
    "paju-ghost-2",
    "paju-ghost-3",
    "party-planner",
    "schedule-maker",
    "so-hot",
    "suika-master",
    "weekend-regular",
    "writing-master"
  ].sort());
});
