const assert = require("node:assert");
const { test } = require("node:test");
const {
  TROPHIES,
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  newlyEarnedTrophyIds
} = require("./trophies.js");

test("TROPHIES: 5개 트로피 각각 id/name/description/image를 가진다", () => {
  assert.strictEqual(TROPHIES.length, 5);
  TROPHIES.forEach((t) => {
    assert.ok(typeof t.id === "string" && t.id.length > 0);
    assert.ok(typeof t.name === "string" && t.name.length > 0);
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    assert.strictEqual(t.image, `/assets/trophies/${t.id}.png`);
  });
});

test("checkAttendanceTrophies: 9회면 빈 배열", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(9), []);
});

test("checkAttendanceTrophies: 10회면 kongz-regular만", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(10), ["kongz-regular"]);
});

test("checkAttendanceTrophies: 30회면 kongz-regular와 kongz-veteran 모두", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(30), ["kongz-regular", "kongz-veteran"]);
});

test("checkScheduleMakerTrophy: 9개면 빈 배열, 10개면 schedule-maker", () => {
  assert.deepStrictEqual(checkScheduleMakerTrophy(9), []);
  assert.deepStrictEqual(checkScheduleMakerTrophy(10), ["schedule-maker"]);
});

test("checkFullHouseTrophy: 4회면 빈 배열, 5회면 full-house-king", () => {
  assert.deepStrictEqual(checkFullHouseTrophy(4), []);
  assert.deepStrictEqual(checkFullHouseTrophy(5), ["full-house-king"]);
});

test("checkGame2048Trophy: 1위가 아니면 빈 배열, 1위면 game-2048-champion", () => {
  assert.deepStrictEqual(checkGame2048Trophy(false), []);
  assert.deepStrictEqual(checkGame2048Trophy(true), ["game-2048-champion"]);
});

test("newlyEarnedTrophyIds: 이미 보유한 id는 제외하고 신규만 반환", () => {
  assert.deepStrictEqual(
    newlyEarnedTrophyIds(["kongz-regular"], ["kongz-regular", "schedule-maker"]),
    ["schedule-maker"]
  );
});

test("newlyEarnedTrophyIds: 후보가 비어있으면 빈 배열", () => {
  assert.deepStrictEqual(newlyEarnedTrophyIds(["kongz-regular"], []), []);
});
