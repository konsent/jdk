import assert from "node:assert";
import { test } from "node:test";
import {
  createEmptyGrid, addRandomTile, move, isGameOver
} from "./game2048.js";

test("createEmptyGrid: 4x4 모두 0", () => {
  const grid = createEmptyGrid();
  assert.strictEqual(grid.length, 4);
  grid.forEach(row => {
    assert.strictEqual(row.length, 4);
    row.forEach(cell => assert.strictEqual(cell, 0));
  });
});

test("addRandomTile: 빈 칸 하나에만 2 또는 4가 채워진다", () => {
  const grid = createEmptyGrid();
  const next = addRandomTile(grid);
  const nonZero = next.flat().filter(v => v !== 0);
  assert.strictEqual(nonZero.length, 1);
  assert.ok(nonZero[0] === 2 || nonZero[0] === 4);
});

test("addRandomTile: 빈 칸이 없으면 그대로 반환", () => {
  const full = [[2,2,2,2],[2,2,2,2],[2,2,2,2],[2,2,2,2]];
  const next = addRandomTile(full);
  assert.deepStrictEqual(next, full);
});

test("move left: 같은 값 두 개가 만나면 병합되고 점수가 오른다", () => {
  const grid = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const result = move(grid, "left");
  assert.deepStrictEqual(result.grid[0], [4, 0, 0, 0]);
  assert.strictEqual(result.moved, true);
  assert.strictEqual(result.scoreGained, 4);
});

test("move left: 세 개 연속은 앞쪽 두 개만 병합된다 (2 2 2 0 -> 4 2 0 0)", () => {
  const grid = [
    [2, 2, 2, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const result = move(grid, "left");
  assert.deepStrictEqual(result.grid[0], [4, 2, 0, 0]);
});

test("move right: 오른쪽 정렬 및 병합", () => {
  const grid = [
    [0, 0, 2, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const result = move(grid, "right");
  assert.deepStrictEqual(result.grid[0], [0, 0, 0, 4]);
});

test("move up: 위쪽 정렬 및 병합", () => {
  const grid = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const result = move(grid, "up");
  assert.strictEqual(result.grid[0][0], 4);
  assert.strictEqual(result.grid[1][0], 0);
});

test("move down: 아래쪽 정렬 및 병합", () => {
  const grid = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const result = move(grid, "down");
  assert.strictEqual(result.grid[3][0], 4);
  assert.strictEqual(result.grid[2][0], 0);
});

test("move: 변화가 없으면 moved=false", () => {
  const grid = [
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const result = move(grid, "left");
  assert.strictEqual(result.moved, false);
  assert.strictEqual(result.scoreGained, 0);
});

test("isGameOver: 빈 칸이 있으면 false", () => {
  const grid = [
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  assert.strictEqual(isGameOver(grid), false);
});

test("isGameOver: 꽉 찼지만 인접 병합 가능하면 false", () => {
  const grid = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 4]
  ];
  assert.strictEqual(isGameOver(grid), false);
});

test("isGameOver: 꽉 차고 병합 불가능하면 true", () => {
  const grid = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ];
  assert.strictEqual(isGameOver(grid), true);
});
