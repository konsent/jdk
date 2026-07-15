const assert = require("node:assert");
const { test } = require("node:test");
const {
  TROPHIES,
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  checkWritingMasterTrophy,
  checkHeartthrobTrophy,
  computeKongzTempServer,
  checkKongzTempTrophies,
  newlyEarnedTrophyIds
} = require("./trophies.js");

test("TROPHIES: 12개 트로피 각각 id/name/description/image를 가진다", () => {
  assert.strictEqual(TROPHIES.length, 12);
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

test("checkAttendanceTrophies: 49회면 kongz-regular/veteran만, paju-ghost 없음", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(49), ["kongz-regular", "kongz-veteran"]);
});

test("checkAttendanceTrophies: 50회면 paju-ghost-1까지", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(50), ["kongz-regular", "kongz-veteran", "paju-ghost-1"]);
});

test("checkAttendanceTrophies: 75회면 paju-ghost-2까지", () => {
  assert.deepStrictEqual(
    checkAttendanceTrophies(75),
    ["kongz-regular", "kongz-veteran", "paju-ghost-1", "paju-ghost-2"]
  );
});

test("checkAttendanceTrophies: 100회면 paju-ghost-3까지 전부", () => {
  assert.deepStrictEqual(
    checkAttendanceTrophies(100),
    ["kongz-regular", "kongz-veteran", "paju-ghost-1", "paju-ghost-2", "paju-ghost-3"]
  );
});

test("checkWritingMasterTrophy: 29개면 빈 배열, 30개면 writing-master", () => {
  assert.deepStrictEqual(checkWritingMasterTrophy(29), []);
  assert.deepStrictEqual(checkWritingMasterTrophy(30), ["writing-master"]);
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

test("checkHeartthrobTrophy: ratingCount 9면 평균 무관하게 빈 배열", () => {
  const stats = { ratingCount: 9, ratingSum: { manner: 45, skill: 45, again: 45 } };
  assert.deepStrictEqual(checkHeartthrobTrophy(stats), []);
});

test("checkHeartthrobTrophy: ratingCount 10, 평균 4.5 미만이면 빈 배열", () => {
  const stats = { ratingCount: 10, ratingSum: { manner: 40, skill: 40, again: 40 } };
  assert.deepStrictEqual(checkHeartthrobTrophy(stats), []);
});

test("checkHeartthrobTrophy: ratingCount 10, 평균 4.5 이상이면 heartthrob", () => {
  const stats = { ratingCount: 10, ratingSum: { manner: 45, skill: 45, again: 45 } };
  assert.deepStrictEqual(checkHeartthrobTrophy(stats), ["heartthrob"]);
});

test("checkHeartthrobTrophy: memberStats undefined면 빈 배열", () => {
  assert.deepStrictEqual(checkHeartthrobTrophy(undefined), []);
});

test("computeKongzTempServer: ratingCount 0이면 36.5도 기본값", () => {
  assert.deepStrictEqual(computeKongzTempServer(undefined), { temp: 36.5, count: 0 });
});

test("computeKongzTempServer: 매너/실력/재만남 모두 5점 만점이면 62.5도", () => {
  const stats = { ratingCount: 1, ratingSum: { manner: 5, skill: 5, again: 5 } };
  assert.deepStrictEqual(computeKongzTempServer(stats), { temp: 62.5, count: 1 });
});

test("checkKongzTempTrophies: 60도 미만이면 빈 배열", () => {
  const stats = { ratingCount: 1, ratingSum: { manner: 3, skill: 3, again: 3 } };
  assert.deepStrictEqual(checkKongzTempTrophies(stats), []);
});

test("checkKongzTempTrophies: 60도 이상 62도 미만이면 kongz-hot만", () => {
  const stats = { ratingCount: 10, ratingSum: { manner: 50, skill: 50, again: 47 } };
  assert.deepStrictEqual(checkKongzTempTrophies(stats), ["kongz-hot"]);
});

test("checkKongzTempTrophies: 62도 이상이면 kongz-hot과 so-hot 모두", () => {
  const stats = { ratingCount: 1, ratingSum: { manner: 5, skill: 5, again: 5 } };
  assert.deepStrictEqual(checkKongzTempTrophies(stats), ["kongz-hot", "so-hot"]);
});
