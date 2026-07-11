const assert = require("node:assert");
const { test } = require("node:test");
const { shouldNotify, buildMessage } = require("./index.js");

test("shouldNotify: pending으로 신규 생성되면 true", () => {
  assert.strictEqual(shouldNotify(undefined, { status: "pending" }), true);
});

test("shouldNotify: rejected에서 pending으로 재신청하면 true", () => {
  assert.strictEqual(shouldNotify({ status: "rejected" }, { status: "pending" }), true);
});

test("shouldNotify: pending에서 approved로 바뀌면 false", () => {
  assert.strictEqual(shouldNotify({ status: "pending" }, { status: "approved" }), false);
});

test("shouldNotify: pending 문서가 삭제되면(afterData undefined) false", () => {
  assert.strictEqual(shouldNotify({ status: "pending" }, undefined), false);
});

test("shouldNotify: pending에서 pending으로 변화 없으면 false", () => {
  assert.strictEqual(shouldNotify({ status: "pending" }, { status: "pending" }), false);
});

test("buildMessage: 닉네임과 이메일, admin 링크를 포함한다", () => {
  const msg = buildMessage({ nickname: "홍길동", email: "hong@example.com" });
  assert.strictEqual(
    msg,
    "새 가입 신청: 홍길동 (hong@example.com)\nhttps://www.jdkclub.click/admin/"
  );
});
