import assert from "node:assert";
import { test } from "node:test";
import {
  checkAttendanceTrophies, checkScheduleMakerTrophy, checkFullHouseTrophy,
  checkWritingMasterTrophy, checkHeartthrobTrophy, computeKongzTempServer,
  checkKongzTempTrophies, checkGame2048Trophy, checkSuikaMasterTrophy,
  checkAnnualMemberTrophy, checkPartyPlannerTrophy, checkNoNoshowTrophy,
  checkWeekendRegularTrophy, hasConsecutiveDays, checkFiveDayStreakTrophy,
  newlyEarnedTrophyIds
} from "./trophy-conditions.js";

test("checkAttendanceTrophies: 100회면 전체 5단계 모두 반환", () => {
  assert.deepStrictEqual(
    checkAttendanceTrophies(100),
    ["kongz-regular", "kongz-veteran", "paju-ghost-1", "paju-ghost-2", "paju-ghost-3"]
  );
});

test("checkScheduleMakerTrophy / checkWritingMasterTrophy: 임계값 확인", () => {
  assert.deepStrictEqual(checkScheduleMakerTrophy(9), []);
  assert.deepStrictEqual(checkScheduleMakerTrophy(10), ["schedule-maker"]);
  assert.deepStrictEqual(checkWritingMasterTrophy(29), []);
  assert.deepStrictEqual(checkWritingMasterTrophy(30), ["writing-master"]);
});

test("checkFullHouseTrophy: 임계값 확인", () => {
  assert.deepStrictEqual(checkFullHouseTrophy(4), []);
  assert.deepStrictEqual(checkFullHouseTrophy(5), ["full-house-king"]);
});

test("checkHeartthrobTrophy: ratingCount 10, 평균 4.5 이상이면 heartthrob", () => {
  const stats = { ratingCount: 10, ratingSum: { manner: 45, skill: 45, again: 45 } };
  assert.deepStrictEqual(checkHeartthrobTrophy(stats), ["heartthrob"]);
});

test("computeKongzTempServer / checkKongzTempTrophies: 62.5도면 kongz-hot+so-hot", () => {
  const stats = { ratingCount: 1, ratingSum: { manner: 5, skill: 5, again: 5 } };
  assert.deepStrictEqual(computeKongzTempServer(stats), { temp: 62.5, count: 1 });
  assert.deepStrictEqual(checkKongzTempTrophies(stats), ["kongz-hot", "so-hot"]);
});

test("checkGame2048Trophy / checkSuikaMasterTrophy: 1위 여부", () => {
  assert.deepStrictEqual(checkGame2048Trophy(true), ["game-2048-champion"]);
  assert.deepStrictEqual(checkSuikaMasterTrophy(true), ["suika-master"]);
});

test("checkAnnualMemberTrophy: true만 수여", () => {
  assert.deepStrictEqual(checkAnnualMemberTrophy(true), ["annual-member"]);
  assert.deepStrictEqual(checkAnnualMemberTrophy(false), []);
});

test("checkPartyPlannerTrophy: 3개 이상", () => {
  assert.deepStrictEqual(checkPartyPlannerTrophy(2), []);
  assert.deepStrictEqual(checkPartyPlannerTrophy(3), ["party-planner"]);
});

test("checkNoNoshowTrophy / checkWeekendRegularTrophy: 임계값 확인", () => {
  assert.deepStrictEqual(checkNoNoshowTrophy(19), []);
  assert.deepStrictEqual(checkNoNoshowTrophy(20), ["no-noshow-20"]);
  assert.deepStrictEqual(checkWeekendRegularTrophy(9), []);
  assert.deepStrictEqual(checkWeekendRegularTrophy(10), ["weekend-regular"]);
});

test("hasConsecutiveDays / checkFiveDayStreakTrophy: 연속 5일 판정", () => {
  const dates = [
    new Date("2026-01-01"), new Date("2026-01-02"), new Date("2026-01-03"),
    new Date("2026-01-04"), new Date("2026-01-05")
  ];
  assert.strictEqual(hasConsecutiveDays(dates, 5), true);
  assert.deepStrictEqual(checkFiveDayStreakTrophy(true), ["five-day-streak"]);
  assert.deepStrictEqual(checkFiveDayStreakTrophy(false), []);
});

test("newlyEarnedTrophyIds: 이미 보유한 id 제외", () => {
  assert.deepStrictEqual(
    newlyEarnedTrophyIds(["kongz-regular"], ["kongz-regular", "schedule-maker"]),
    ["schedule-maker"]
  );
});
