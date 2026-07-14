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
    "새 가입 신청이 도착했습니다.\n\n가입자 닉네임: 홍길동\n가입자 이메일: hong@example.com\n\n사이트 바로가기: https://www.jdkclub.click/admin/"
  );
});

const { parseSearchResults } = require("./index.js");

test("parseSearchResults: 검색 결과 XML에서 id/name/연도를 추출한다", () => {
  const xml = `<?xml version="1.0"?>
<items total="2" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="13">
  <name type="primary" value="CATAN"/>
  <yearpublished value="1995"/>
</item>
<item type="boardgame" id="9209">
  <name type="primary" value="Catan: Cities and Knights"/>
  <yearpublished value="1998"/>
</item>
</items>`;
  assert.deepStrictEqual(parseSearchResults(xml), [
    { bggId: "13", name: "CATAN", yearPublished: "1995" },
    { bggId: "9209", name: "Catan: Cities and Knights", yearPublished: "1998" }
  ]);
});

test("parseSearchResults: 결과 없으면 빈 배열", () => {
  const xml = `<?xml version="1.0"?><items total="0" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"></items>`;
  assert.deepStrictEqual(parseSearchResults(xml), []);
});

test("parseSearchResults: yearpublished 없는 아이템은 yearPublished undefined", () => {
  const xml = `<?xml version="1.0"?>
<items total="1" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="42">
  <name type="primary" value="Mystery Game"/>
</item>
</items>`;
  assert.deepStrictEqual(parseSearchResults(xml), [
    { bggId: "42", name: "Mystery Game", yearPublished: undefined }
  ]);
});

const { fetchWithRetry } = require("./index.js");

test("fetchWithRetry: 200 응답이면 바로 본문을 반환한다", async () => {
  const fakeFetch = async () => ({
    status: 200,
    ok: true,
    text: async () => "immediate body"
  });
  const result = await fetchWithRetry("https://example.com", fakeFetch);
  assert.strictEqual(result, "immediate body");
});

test("fetchWithRetry: 202 응답이면 정확히 한 번 재시도하고 재시도 결과를 반환한다", async () => {
  let callCount = 0;
  const fakeFetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return { status: 202, ok: false, text: async () => "queued" };
    }
    return { status: 200, ok: true, text: async () => "retried body" };
  };
  const result = await fetchWithRetry("https://example.com", fakeFetch);
  assert.strictEqual(callCount, 2);
  assert.strictEqual(result, "retried body");
});

test("fetchWithRetry: 재시도 후에도 실패하면 null을 반환한다", async () => {
  const fakeFetch = async () => ({
    status: 202,
    ok: false,
    text: async () => "still queued"
  });
  const result = await fetchWithRetry("https://example.com", fakeFetch);
  assert.strictEqual(result, null);
});

test("fetchWithRetry: 404처럼 재시도 없는 실패 응답도 null을 반환한다", async () => {
  const fakeFetch = async () => ({
    status: 404,
    ok: false,
    text: async () => "not found"
  });
  const result = await fetchWithRetry("https://example.com", fakeFetch);
  assert.strictEqual(result, null);
});
