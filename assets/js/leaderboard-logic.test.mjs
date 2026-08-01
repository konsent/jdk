import assert from "node:assert";
import { test } from "node:test";
import { rankWeekly, rankAllTime, myRankIndex, countAhead } from "./leaderboard-logic.js";

const docs = [
  { uid: "a", best: 100, weekBest: 10, weekKey: "2026-W31" },
  { uid: "b", best: 300, weekBest: 50, weekKey: "2026-W31" },
  { uid: "c", best: 200, weekBest: 99, weekKey: "2026-W30" }, // 지난 주 기록
  { uid: "d", weekKey: "2026-W31" }                            // 점수 필드 없음
];

test("rankAllTime: 최고점 내림차순, 점수 없으면 0", () => {
  const r = rankAllTime(docs, "best");
  assert.deepStrictEqual(r.map((e) => e.uid), ["b", "c", "a", "d"]);
  assert.strictEqual(r.at(-1).value, 0);
});

test("rankWeekly: 이번 주 기록만 남기고 정렬한다", () => {
  const r = rankWeekly(docs, "2026-W31");
  assert.deepStrictEqual(r.map((e) => e.uid), ["b", "a", "d"]);
  assert.ok(!r.some((e) => e.uid === "c"), "지난 주 기록은 제외돼야 한다");
});

test("myRankIndex: 기록이 없으면 -1", () => {
  const r = rankAllTime(docs, "best");
  assert.strictEqual(myRankIndex(r, "a"), 2);
  assert.strictEqual(myRankIndex(r, "없는사람"), -1);
});

test("countAhead: 나보다 높은 점수만 센다(동점은 앞서지 않음)", () => {
  assert.strictEqual(countAhead(docs, "best", 200), 1);   // b(300) 만
  assert.strictEqual(countAhead(docs, "best", 0), 3);     // a,b,c
  assert.strictEqual(countAhead(docs, "best", 999), 0);
});
