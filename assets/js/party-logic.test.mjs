import assert from "node:assert";
import { test } from "node:test";
import { normalizeMembers, filterByNickname } from "./party-logic.js";

test("normalizeMembers: ownerUid가 없으면 자동으로 추가", () => {
  assert.deepStrictEqual(normalizeMembers("owner1", ["a", "b"]), ["owner1", "a", "b"]);
});

test("normalizeMembers: ownerUid가 이미 있으면 중복 추가하지 않음", () => {
  assert.deepStrictEqual(normalizeMembers("owner1", ["a", "owner1", "b"]), ["a", "owner1", "b"]);
});

test("normalizeMembers: 멤버 중복 제거", () => {
  assert.deepStrictEqual(normalizeMembers("owner1", ["a", "a", "b"]), ["owner1", "a", "b"]);
});

test("normalizeMembers: 빈 배열이면 ownerUid만 남음", () => {
  assert.deepStrictEqual(normalizeMembers("owner1", []), ["owner1"]);
});

test("filterByNickname: 부분일치 대소문자 무시", () => {
  const users = [
    { uid: "1", nickname: "도연" },
    { uid: "2", nickname: "카레" },
    { uid: "3", nickname: "산도깨비" }
  ];
  assert.deepStrictEqual(filterByNickname(users, "도연"), [{ uid: "1", nickname: "도연" }]);
  assert.deepStrictEqual(filterByNickname(users, "도"), [
    { uid: "1", nickname: "도연" },
    { uid: "3", nickname: "산도깨비" }
  ]);
});

test("filterByNickname: 빈 query면 빈 배열", () => {
  const users = [{ uid: "1", nickname: "다소" }];
  assert.deepStrictEqual(filterByNickname(users, ""), []);
  assert.deepStrictEqual(filterByNickname(users, "  "), []);
});
