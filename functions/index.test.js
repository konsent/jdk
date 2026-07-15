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

const { parseGameDetail } = require("./index.js");

test("parseGameDetail: thing XML에서 이름/연도/썸네일을 추출한다", () => {
  const xml = `<?xml version="1.0"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="13">
  <thumbnail>https://cf.geekdo-images.com/thumb/catan.jpg</thumbnail>
  <image>https://cf.geekdo-images.com/full/catan.jpg</image>
  <name type="primary" sortindex="1" value="Catan"/>
  <name type="alternate" sortindex="1" value="Los Colonos de Catan"/>
  <yearpublished value="1995"/>
</item>
</items>`;
  assert.deepStrictEqual(parseGameDetail(xml, "13"), {
    bggId: "13",
    name: "Catan",
    yearPublished: "1995",
    thumbnail: "https://cf.geekdo-images.com/thumb/catan.jpg"
  });
});

test("parseGameDetail: 아이템이 없으면 null", () => {
  const xml = `<?xml version="1.0"?><items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"></items>`;
  assert.strictEqual(parseGameDetail(xml, "999"), null);
});

test("parseGameDetail: thumbnail 없으면 thumbnail undefined", () => {
  const xml = `<?xml version="1.0"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="42">
  <name type="primary" sortindex="1" value="Mystery Game"/>
  <yearpublished value="2020"/>
</item>
</items>`;
  assert.deepStrictEqual(parseGameDetail(xml, "42"), {
    bggId: "42",
    name: "Mystery Game",
    yearPublished: "2020",
    thumbnail: undefined
  });
});

const { buildTrophyCandidates, countFullHouseEvents } = require("./index.js");

test("buildTrophyCandidates: 출석10+게시글10+만석5 모두 만족하면 4개 트로피 후보", () => {
  assert.deepStrictEqual(
    buildTrophyCandidates({ attendCount: 30, postCount: 10 }, 5).sort(),
    ["full-house-king", "kongz-regular", "kongz-veteran", "schedule-maker"].sort()
  );
});

test("buildTrophyCandidates: 아무 조건도 만족 못하면 빈 배열", () => {
  assert.deepStrictEqual(buildTrophyCandidates({ attendCount: 0, postCount: 0 }, 0), []);
});

test("buildTrophyCandidates: memberStats가 undefined면 빈 배열", () => {
  assert.deepStrictEqual(buildTrophyCandidates(undefined, 0), []);
});

test("buildTrophyCandidates: 출석100+게시글30+평점10회5.0+온도62.5 모두 만족하면 전체 트로피 반환", () => {
  const memberStats = {
    attendCount: 100,
    postCount: 30,
    ratingCount: 10,
    ratingSum: { manner: 50, skill: 50, again: 50 }
  };
  const result = buildTrophyCandidates(memberStats, 5).sort();
  assert.deepStrictEqual(result, [
    "full-house-king",
    "heartthrob",
    "kongz-hot",
    "kongz-regular",
    "kongz-veteran",
    "paju-ghost-1",
    "paju-ghost-2",
    "paju-ghost-3",
    "schedule-maker",
    "so-hot",
    "writing-master"
  ].sort());
});

test("buildTrophyCandidates: 평점/온도 조건 미달이면 heartthrob/kongz-hot/so-hot 없음", () => {
  const memberStats = { attendCount: 0, postCount: 0, ratingCount: 0, ratingSum: {} };
  assert.deepStrictEqual(buildTrophyCandidates(memberStats, 0), []);
});

test("countFullHouseEvents: authorUid가 작성한 이벤트 중 만석인 것만 센다", () => {
  const posts = [
    { authorUid: "u1", attendees: ["a", "b"], maxAttendees: 2 },
    { authorUid: "u1", attendees: ["a"], maxAttendees: 2 },
    { authorUid: "u2", attendees: ["a", "b"], maxAttendees: 2 }
  ];
  assert.strictEqual(countFullHouseEvents(posts, "u1"), 1);
});

test("countFullHouseEvents: 작성한 이벤트가 없으면 0", () => {
  assert.strictEqual(countFullHouseEvents([], "u1"), 0);
});

const { isTopScorer, mapSuikaScores } = require("./index.js");

test("isTopScorer: 최고 점수 보유자면 true", () => {
  const scores = [
    { uid: "u1", bestScore: 100 },
    { uid: "u2", bestScore: 200 }
  ];
  assert.strictEqual(isTopScorer(scores, "u2"), true);
  assert.strictEqual(isTopScorer(scores, "u1"), false);
});

test("isTopScorer: 동점자는 모두 true", () => {
  const scores = [
    { uid: "u1", bestScore: 200 },
    { uid: "u2", bestScore: 200 }
  ];
  assert.strictEqual(isTopScorer(scores, "u1"), true);
  assert.strictEqual(isTopScorer(scores, "u2"), true);
});

test("isTopScorer: 점수가 없으면 false", () => {
  assert.strictEqual(isTopScorer([], "u1"), false);
});

test("mapSuikaScores: {id, best} 배열을 {uid, bestScore}로 매핑한다", () => {
  const docs = [{ id: "u1", best: 100 }, { id: "u2", best: 300 }];
  assert.deepStrictEqual(mapSuikaScores(docs), [
    { uid: "u1", bestScore: 100 },
    { uid: "u2", bestScore: 300 }
  ]);
});

test("mapSuikaScores: best 필드가 없으면 bestScore 0으로 매핑", () => {
  assert.deepStrictEqual(mapSuikaScores([{ id: "u1" }]), [{ uid: "u1", bestScore: 0 }]);
});

test("isTopScorer: mapSuikaScores로 매핑한 결과에도 동일하게 동작", () => {
  const mapped = mapSuikaScores([{ id: "u1", best: 100 }, { id: "u2", best: 300 }]);
  assert.strictEqual(isTopScorer(mapped, "u2"), true);
  assert.strictEqual(isTopScorer(mapped, "u1"), false);
});
