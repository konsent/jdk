import assert from "node:assert";
import { test } from "node:test";
import {
  getRatingTargets, canRateNow, ratingDocId, computeAverages
} from "./rating-logic.js";

test("getRatingTargets: confirmedAttendees가 있으면 그것을 사용하고 본인 제외", () => {
  const post = { attendees: ["a", "b", "c"], confirmedAttendees: ["a", "b"] };
  assert.deepStrictEqual(getRatingTargets(post, "a"), ["b"]);
});

test("getRatingTargets: confirmedAttendees가 없으면 attendees로 fallback", () => {
  const post = { attendees: ["a", "b", "c"] };
  assert.deepStrictEqual(getRatingTargets(post, "a"), ["b", "c"]);
});

test("getRatingTargets: attendees도 없으면 빈 배열", () => {
  assert.deepStrictEqual(getRatingTargets({}, "a"), []);
});

test("canRateNow: eventDate 당일 23:59는 아직 불가", () => {
  const eventDate = new Date("2026-07-10T00:00:00");
  const now = new Date("2026-07-10T23:59:00");
  assert.strictEqual(canRateNow(eventDate, now), false);
});

test("canRateNow: eventDate 다음날 00:00 이후는 가능", () => {
  const eventDate = new Date("2026-07-10T00:00:00");
  const now = new Date("2026-07-11T00:00:01");
  assert.strictEqual(canRateNow(eventDate, now), true);
});

test("canRateNow: eventDate 다음날 자정 정각도 가능", () => {
  const eventDate = new Date("2026-07-10T19:00:00");
  const now = new Date("2026-07-11T00:00:00");
  assert.strictEqual(canRateNow(eventDate, now), true);
});

test("ratingDocId: postId_raterUid_targetUid 형식", () => {
  assert.strictEqual(ratingDocId("post1", "userA", "userB"), "post1_userA_userB");
});

test("computeAverages: ratingCount가 0이면 전부 null", () => {
  const result = computeAverages({ ratingSum: { manner: 0, skill: 0, again: 0 }, ratingCount: 0 });
  assert.deepStrictEqual(result, { manner: null, skill: null, again: null, count: 0 });
});

test("computeAverages: memberStats가 undefined면 전부 null, count 0", () => {
  assert.deepStrictEqual(computeAverages(undefined), { manner: null, skill: null, again: null, count: 0 });
});

test("computeAverages: 합/횟수로 평균을 소수 첫째자리까지 계산", () => {
  const result = computeAverages({ ratingSum: { manner: 14, skill: 9, again: 15 }, ratingCount: 3 });
  assert.deepStrictEqual(result, { manner: 4.7, skill: 3, again: 5, count: 3 });
});
