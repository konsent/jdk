import assert from "node:assert";
import { test } from "node:test";
import {
  TIERS, getTier, randomDropTier, mergeResult, weekKey
} from "./suika-logic.js";

test("TIERS: 9단계, 반지름 단조 증가", () => {
  assert.strictEqual(TIERS.length, 9);
  for (let i = 1; i < TIERS.length; i++) {
    assert.ok(TIERS[i].radius > TIERS[i - 1].radius);
  }
});

test("getTier: 1-기반 조회", () => {
  assert.strictEqual(getTier(1).label, "d4");
  assert.strictEqual(getTier(6).label, "d20");
  assert.strictEqual(getTier(9).label, "콩");
});

test("mergeResult: 다음 단계와 그 단계의 점수를 반환", () => {
  assert.deepStrictEqual(mergeResult(1), { next: 2, score: 3 });
  assert.deepStrictEqual(mergeResult(2), { next: 3, score: 6 });
  assert.deepStrictEqual(mergeResult(5), { next: 6, score: 21 });
  assert.deepStrictEqual(mergeResult(8), { next: 9, score: 66 });
});

test("mergeResult: 최종 단계(9)끼리는 소멸하고 66점", () => {
  assert.deepStrictEqual(mergeResult(9), { next: null, score: 66 });
});

test("randomDropTier: 항상 1~5 범위", () => {
  assert.strictEqual(randomDropTier(() => 0), 1);
  assert.strictEqual(randomDropTier(() => 0.999999), 5);
  for (let i = 0; i < 100; i++) {
    const t = randomDropTier();
    assert.ok(t >= 1 && t <= 5);
  }
});

test("weekKey: ISO 주차 (연말 경계 포함)", () => {
  assert.strictEqual(weekKey(new Date(2026, 6, 13)), "2026-W29");  // 월요일
  assert.strictEqual(weekKey(new Date(2026, 0, 4)), "2026-W01");   // 일요일, 1주차 끝
  assert.strictEqual(weekKey(new Date(2026, 0, 5)), "2026-W02");   // 월요일
  assert.strictEqual(weekKey(new Date(2025, 11, 29)), "2026-W01"); // 2025-12-29(월)는 2026년 1주차
});
