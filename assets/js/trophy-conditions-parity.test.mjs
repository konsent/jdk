import assert from "node:assert";
import { test } from "node:test";
import { createRequire } from "node:module";
import * as client from "./trophy-conditions.js";

const require = createRequire(import.meta.url);
const server = require("../../functions/trophies.js");

const SHARED_FUNCTION_NAMES = [
  "checkAttendanceTrophies", "checkScheduleMakerTrophy", "checkFullHouseTrophy",
  "checkWritingMasterTrophy", "checkHeartthrobTrophy", "computeKongzTempServer",
  "checkKongzTempTrophies", "checkGame2048Trophy", "checkSuikaMasterTrophy",
  "checkAnnualMemberTrophy", "checkPartyPlannerTrophy", "checkNoNoshowTrophy",
  "checkWeekendRegularTrophy", "checkFiveDayStreakTrophy", "newlyEarnedTrophyIds"
];

test("trophy-conditions.js exports the same functions as functions/trophies.js", () => {
  for (const name of SHARED_FUNCTION_NAMES) {
    assert.strictEqual(typeof client[name], "function", `client missing ${name}`);
    assert.strictEqual(typeof server[name], "function", `server missing ${name}`);
  }
});

test("parity: checkAttendanceTrophies over representative attendCount values", () => {
  for (const n of [0, 9, 10, 29, 30, 49, 50, 74, 75, 99, 100, 150]) {
    assert.deepStrictEqual(client.checkAttendanceTrophies(n), server.checkAttendanceTrophies(n), `attendCount=${n}`);
  }
});

test("parity: checkScheduleMakerTrophy / checkWritingMasterTrophy", () => {
  for (const n of [0, 9, 10, 29, 30, 50]) {
    assert.deepStrictEqual(client.checkScheduleMakerTrophy(n), server.checkScheduleMakerTrophy(n), `postCount=${n}`);
    assert.deepStrictEqual(client.checkWritingMasterTrophy(n), server.checkWritingMasterTrophy(n), `postCount=${n}`);
  }
});

test("parity: checkFullHouseTrophy", () => {
  for (const n of [0, 4, 5, 10]) {
    assert.deepStrictEqual(client.checkFullHouseTrophy(n), server.checkFullHouseTrophy(n), `fullCount=${n}`);
  }
});

test("parity: checkHeartthrobTrophy / computeKongzTempServer / checkKongzTempTrophies", () => {
  const cases = [
    undefined,
    { ratingCount: 0, ratingSum: {} },
    { ratingCount: 9, ratingSum: { manner: 45, skill: 45, again: 45 } },
    { ratingCount: 10, ratingSum: { manner: 40, skill: 40, again: 40 } },
    { ratingCount: 10, ratingSum: { manner: 45, skill: 45, again: 45 } },
    { ratingCount: 1, ratingSum: { manner: 3, skill: 3, again: 3 } },
    { ratingCount: 10, ratingSum: { manner: 50, skill: 50, again: 47 } },
    { ratingCount: 1, ratingSum: { manner: 5, skill: 5, again: 5 } }
  ];
  for (const stats of cases) {
    assert.deepStrictEqual(client.checkHeartthrobTrophy(stats), server.checkHeartthrobTrophy(stats), JSON.stringify(stats));
    assert.deepStrictEqual(client.computeKongzTempServer(stats), server.computeKongzTempServer(stats), JSON.stringify(stats));
    assert.deepStrictEqual(client.checkKongzTempTrophies(stats), server.checkKongzTempTrophies(stats), JSON.stringify(stats));
  }
});

test("parity: checkGame2048Trophy / checkSuikaMasterTrophy", () => {
  for (const v of [true, false]) {
    assert.deepStrictEqual(client.checkGame2048Trophy(v), server.checkGame2048Trophy(v));
    assert.deepStrictEqual(client.checkSuikaMasterTrophy(v), server.checkSuikaMasterTrophy(v));
  }
});

test("parity: checkAnnualMemberTrophy", () => {
  for (const v of [true, false, undefined]) {
    assert.deepStrictEqual(client.checkAnnualMemberTrophy(v), server.checkAnnualMemberTrophy(v));
  }
});

test("parity: checkPartyPlannerTrophy / checkNoNoshowTrophy / checkWeekendRegularTrophy", () => {
  for (const n of [0, 2, 3, 19, 20, 9, 10]) {
    assert.deepStrictEqual(client.checkPartyPlannerTrophy(n), server.checkPartyPlannerTrophy(n));
    assert.deepStrictEqual(client.checkNoNoshowTrophy(n), server.checkNoNoshowTrophy(n));
    assert.deepStrictEqual(client.checkWeekendRegularTrophy(n), server.checkWeekendRegularTrophy(n));
  }
});

test("parity: checkFiveDayStreakTrophy", () => {
  for (const v of [true, false]) {
    assert.deepStrictEqual(client.checkFiveDayStreakTrophy(v), server.checkFiveDayStreakTrophy(v));
  }
});

test("parity: newlyEarnedTrophyIds", () => {
  const cases = [
    [["kongz-regular"], ["kongz-regular", "schedule-maker"]],
    [["kongz-regular"], []],
    [[], ["annual-member"]]
  ];
  for (const [existing, candidates] of cases) {
    assert.deepStrictEqual(
      client.newlyEarnedTrophyIds(existing, candidates),
      server.newlyEarnedTrophyIds(existing, candidates)
    );
  }
});
