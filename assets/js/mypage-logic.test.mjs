import assert from "node:assert";
import { test } from "node:test";
import { computeVisitStats } from "./mypage-logic.js";

function ts(dateStr) {
  const d = new Date(dateStr);
  return { toDate: () => d };
}

test("computeVisitStats: 참여 이벤트가 없으면 0/0", () => {
  assert.deepStrictEqual(computeVisitStats([], "u1"), { visitDays: 0, participatedSessions: 0 });
});

test("computeVisitStats: closedAt 없는 이벤트는 제외", () => {
  const events = [
    { type: "event", closedAt: null, confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 0, participatedSessions: 0 });
});

test("computeVisitStats: confirmedAttendees에 uid 없으면 제외 (노쇼)", () => {
  const events = [
    { type: "event", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u2"], eventDate: ts("2026-07-01T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 0, participatedSessions: 0 });
});

test("computeVisitStats: type이 event가 아니면 제외", () => {
  const events = [
    { type: "notice", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 0, participatedSessions: 0 });
});

test("computeVisitStats: 같은 날 2개 세션 참여 시 방문일수 1, 세션수 2", () => {
  const events = [
    { type: "event", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T10:00:00") },
    { type: "event", closedAt: ts("2026-07-01T21:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T18:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 1, participatedSessions: 2 });
});

test("computeVisitStats: 다른 날 참여는 각각 별도 방문일로 계산", () => {
  const events = [
    { type: "event", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-01T10:00:00") },
    { type: "event", closedAt: ts("2026-07-02T20:00:00"), confirmedAttendees: ["u1"], eventDate: ts("2026-07-02T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 2, participatedSessions: 2 });
});

test("computeVisitStats: eventDate가 순수 Date 객체여도 동작", () => {
  const events = [
    { type: "event", closedAt: ts("2026-07-01T20:00:00"), confirmedAttendees: ["u1"], eventDate: new Date("2026-07-01T10:00:00") }
  ];
  assert.deepStrictEqual(computeVisitStats(events, "u1"), { visitDays: 1, participatedSessions: 1 });
});
