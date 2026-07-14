# 트로피(업적) 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이페이지에 트로피 그리드를 추가하고, `stats/global`·`game_scores` 문서 변경을 감지하는 Cloud Function이 조건을 판정해 `users/{uid}.trophies`에 기록하며, 신규 획득 트로피를 다음 페이지 로드 시 1회 팝업으로 안내한다.

**Architecture:** 조건 판정 로직은 순수 함수로 `functions/trophies.js`에 작성해 `node --test`로 단위 테스트하고, `functions/index.js`의 `onDocumentWritten` 트리거가 이를 호출해 Firestore에 결과를 쓴다. 클라이언트는 `assets/js/trophies-meta.js`(이름/설명/이미지 메타만, 조건 로직 없음)를 `mypage.js`와 공유하여 그리드 렌더링과 팝업에 사용한다.

**Tech Stack:** Firebase Cloud Functions v2 (`onDocumentWritten`), Firestore, vanilla JS (ES modules), `node:test`/`node:assert` (기존 테스트 방식), 순수 CSS (기존 `.victory-overlay` 애니메이션 재사용).

## Global Constraints

- 트로피 정의는 코드 상수로 관리한다 (Firestore 설정 문서 없음).
- 트로피 이미지 경로: `/assets/trophies/{id}.png` (실제 이미지 파일 제작은 범위 밖 — placeholder 경로만 배선).
- 월별 출석 집계 트로피는 이번 범위에 포함하지 않는다 (인프라 없음).
- 실시간(조건 달성 즉시) 팝업은 범위 밖 — 다음 페이지 로드 시 확인.
- 관리자용 트로피 편집 UI는 범위 밖.
- 기존 `users`, `stats/global`, `game_scores`, `posts` 컬렉션 스키마를 변경하지 않고 필드만 추가한다.
- 테스트는 프레임워크 없이 Node 내장 `node:test` + `assert`를 사용한다 (기존 `functions/index.test.js`, `assets/js/party-logic.test.mjs`와 동일한 패턴).
- **코드 작성은 별도 브랜치에서 진행한다** (`git checkout -b trophy-system` 등 — 사용자 지시).

---

## File Structure

- **Create** `functions/trophies.js` — 트로피 정의(id/name/description/image) + 조건 판정 순수 함수. Cloud Functions에서 사용.
- **Create** `functions/trophies.test.js` — 위 순수 함수 단위 테스트.
- **Modify** `functions/index.js` — `stats/global`, `game_scores/{uid}` 트리거 추가.
- **Modify** `functions/index.test.js` — 트리거 헬퍼(있다면) 테스트 추가. (트리거 자체는 `trophies.js`가 이미 테스트하므로 여기서는 트리거 조합 로직만 다룸)
- **Create** `assets/js/trophies-meta.js` — 클라이언트용 트로피 메타(이름/설명/이미지 경로만, 조건 로직 없음). `functions/trophies.js`의 메타와 내용 동기화 필요 — 조건 로직은 없으므로 중복 최소화.
- **Create** `assets/js/trophies-meta.test.mjs` — 메타 배열 형태 검증(각 항목에 id/name/description/image 존재).
- **Modify** `assets/js/mypage.js` — 트로피 그리드 렌더링, 미확인 트로피 팝업 표시 및 `seen` 갱신.
- **Modify** `mypage.html` — 트로피 섹션 마크업 추가, `game.css` 링크 추가(`.victory-overlay` 재사용).
- **Modify** `assets/css/pages.css` — 트로피 그리드 스타일(`#trophy-grid`, 원형 이미지, 미획득 상태) 추가.

---

## Task 1: 트로피 정의 + 조건 판정 순수 함수 (`functions/trophies.js`)

**Files:**
- Create: `functions/trophies.js`
- Test: `functions/trophies.test.js`

**Interfaces:**
- Produces:
  - `TROPHIES`: `Array<{ id: string, name: string, description: string, image: string }>` — 5개 트로피 메타 (조건 함수는 별도 export로 분리, 메타 자체엔 함수를 담지 않아 `trophies-meta.js`와 순수 JSON 형태로 동기화하기 쉽게 함)
  - `checkAttendanceTrophies(attendCount)`: `string[]` — 만족하는 트로피 id 배열 반환 (`kongz-regular`, `kongz-veteran` 중 해당하는 것)
  - `checkScheduleMakerTrophy(postCount)`: `string[]` — 만족하면 `["schedule-maker"]`, 아니면 `[]`
  - `checkFullHouseTrophy(fullCount)`: `string[]` — 만족하면 `["full-house-king"]`, 아니면 `[]`
  - `checkGame2048Trophy(isTopScorer)`: `string[]` — `isTopScorer === true`면 `["game-2048-champion"]`, 아니면 `[]`
  - `newlyEarnedTrophyIds(existingIds, candidateIds)`: `string[]` — `candidateIds` 중 `existingIds`에 없는 것만 반환 (중복 판정 방지)

- [ ] **Step 1: Write the failing tests**

```js
// functions/trophies.test.js
const assert = require("node:assert");
const { test } = require("node:test");
const {
  TROPHIES,
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  newlyEarnedTrophyIds
} = require("./trophies.js");

test("TROPHIES: 5개 트로피 각각 id/name/description/image를 가진다", () => {
  assert.strictEqual(TROPHIES.length, 5);
  TROPHIES.forEach((t) => {
    assert.ok(typeof t.id === "string" && t.id.length > 0);
    assert.ok(typeof t.name === "string" && t.name.length > 0);
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    assert.strictEqual(t.image, `/assets/trophies/${t.id}.png`);
  });
});

test("checkAttendanceTrophies: 9회면 빈 배열", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(9), []);
});

test("checkAttendanceTrophies: 10회면 kongz-regular만", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(10), ["kongz-regular"]);
});

test("checkAttendanceTrophies: 30회면 kongz-regular와 kongz-veteran 모두", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(30), ["kongz-regular", "kongz-veteran"]);
});

test("checkScheduleMakerTrophy: 9개면 빈 배열, 10개면 schedule-maker", () => {
  assert.deepStrictEqual(checkScheduleMakerTrophy(9), []);
  assert.deepStrictEqual(checkScheduleMakerTrophy(10), ["schedule-maker"]);
});

test("checkFullHouseTrophy: 4회면 빈 배열, 5회면 full-house-king", () => {
  assert.deepStrictEqual(checkFullHouseTrophy(4), []);
  assert.deepStrictEqual(checkFullHouseTrophy(5), ["full-house-king"]);
});

test("checkGame2048Trophy: 1위가 아니면 빈 배열, 1위면 game-2048-champion", () => {
  assert.deepStrictEqual(checkGame2048Trophy(false), []);
  assert.deepStrictEqual(checkGame2048Trophy(true), ["game-2048-champion"]);
});

test("newlyEarnedTrophyIds: 이미 보유한 id는 제외하고 신규만 반환", () => {
  assert.deepStrictEqual(
    newlyEarnedTrophyIds(["kongz-regular"], ["kongz-regular", "schedule-maker"]),
    ["schedule-maker"]
  );
});

test("newlyEarnedTrophyIds: 후보가 비어있으면 빈 배열", () => {
  assert.deepStrictEqual(newlyEarnedTrophyIds(["kongz-regular"], []), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test trophies.test.js`
Expected: FAIL with `Cannot find module './trophies.js'`

- [ ] **Step 3: Write the implementation**

```js
// functions/trophies.js
const TROPHIES = [
  {
    id: "kongz-regular",
    name: "콩즈 죽돌이",
    description: "누적 출석 10회 달성",
    image: "/assets/trophies/kongz-regular.png"
  },
  {
    id: "kongz-veteran",
    name: "콩즈 개근왕",
    description: "누적 출석 30회 달성",
    image: "/assets/trophies/kongz-veteran.png"
  },
  {
    id: "schedule-maker",
    name: "일정 메이커",
    description: "누적 게시글 10개 등록",
    image: "/assets/trophies/schedule-maker.png"
  },
  {
    id: "full-house-king",
    name: "만석 달성왕",
    description: "본인이 등록한 이벤트 만석 5회 달성",
    image: "/assets/trophies/full-house-king.png"
  },
  {
    id: "game-2048-champion",
    name: "2048 간판왕",
    description: "2048 게임 전체 랭킹 1위 달성",
    image: "/assets/trophies/game-2048-champion.png"
  }
];

function checkAttendanceTrophies(attendCount) {
  const ids = [];
  if (attendCount >= 10) ids.push("kongz-regular");
  if (attendCount >= 30) ids.push("kongz-veteran");
  return ids;
}

function checkScheduleMakerTrophy(postCount) {
  return postCount >= 10 ? ["schedule-maker"] : [];
}

function checkFullHouseTrophy(fullCount) {
  return fullCount >= 5 ? ["full-house-king"] : [];
}

function checkGame2048Trophy(isTopScorer) {
  return isTopScorer ? ["game-2048-champion"] : [];
}

function newlyEarnedTrophyIds(existingIds, candidateIds) {
  return candidateIds.filter((id) => !existingIds.includes(id));
}

module.exports = {
  TROPHIES,
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  newlyEarnedTrophyIds
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test trophies.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/trophies.js functions/trophies.test.js
git commit -m "feat: add trophy definitions and condition-checking pure functions"
```

---

## Task 2: `stats/global` 트리거 — 출석/게시글/만석 트로피 판정

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Consumes: `functions/trophies.js`의 `checkAttendanceTrophies`, `checkScheduleMakerTrophy`, `checkFullHouseTrophy`, `newlyEarnedTrophyIds` (Task 1)
- Produces:
  - `buildTrophyCandidates(memberStats, fullCount)`: `string[]` — 한 사용자의 `{attendCount, postCount}`와 만석 횟수를 받아 만족하는 모든 트로피 id 후보 반환 (Task 3에서도 조합 검증용으로 참고 가능)
  - `countFullHouseEvents(posts, authorUid)`: `number` — 특정 uid가 작성한 이벤트 posts 배열에서 만석 횟수 계산 (`stats.js`의 `fullCount` 로직을 Cloud Functions 쪽에 이식)
  - Firestore 트리거: `exports.onStatsUpdated` (`onDocumentWritten("stats/global", ...)`)

- [ ] **Step 1: Write the failing tests**

```js
// functions/index.test.js 에 추가
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test index.test.js`
Expected: FAIL with `buildTrophyCandidates is not a function` (or undefined)

- [ ] **Step 3: Write the implementation**

Add near the top of `functions/index.js`, after the existing requires:

```js
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  newlyEarnedTrophyIds
} = require("./trophies.js");

initializeApp();
```

**참고:** 기존 `functions/index.js`는 Firestore Admin SDK를 전혀 사용하지 않았다 (`onRequest` HTTP 핸들러와 Telegram 알림뿐). 이 태스크가 처음으로 `getFirestore()`를 쓰므로 `initializeApp()` 호출이 반드시 필요하다 — 없으면 배포 후 함수 실행 시 "The default Firebase app does not exist" 에러가 난다.

Add these functions (exported for testing) and the trigger, appended to the end of the file before existing exports stay as-is:

```js
function buildTrophyCandidates(memberStats, fullCount) {
  if (!memberStats) return [];
  return [
    ...checkAttendanceTrophies(memberStats.attendCount || 0),
    ...checkScheduleMakerTrophy(memberStats.postCount || 0),
    ...checkFullHouseTrophy(fullCount || 0)
  ];
}

function countFullHouseEvents(posts, authorUid) {
  return posts.filter(
    (p) => p.authorUid === authorUid && (p.attendees?.length || 0) >= p.maxAttendees
  ).length;
}

async function awardTrophies(db, uid, candidateIds) {
  if (!candidateIds.length) return;
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return;

  const existing = userSnap.data().trophies || [];
  const existingIds = existing.map((t) => t.id);
  const toAward = newlyEarnedTrophyIds(existingIds, candidateIds);
  if (!toAward.length) return;

  const newEntries = toAward.map((id) => ({
    id,
    earnedAt: new Date(),
    seen: false
  }));
  await userRef.update({
    trophies: FieldValue.arrayUnion(...newEntries)
  });
}

exports.onStatsUpdated = onDocumentWritten("stats/global", async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;
  if (!afterData) return;

  const db = getFirestore();
  const members = afterData.members || {};

  for (const [uid, memberStats] of Object.entries(members)) {
    try {
      const postsSnap = await db
        .collection("posts")
        .where("type", "==", "event")
        .where("authorUid", "==", uid)
        .get();
      const fullCount = countFullHouseEvents(
        postsSnap.docs.map((d) => d.data()),
        uid
      );
      const candidates = buildTrophyCandidates(memberStats, fullCount);
      await awardTrophies(db, uid, candidates);
    } catch (err) {
      logger.error(`트로피 판정 실패 (uid: ${uid})`, err);
    }
  }
});

exports.buildTrophyCandidates = buildTrophyCandidates;
exports.countFullHouseEvents = countFullHouseEvents;
```

**참고:** `posts`에 대한 `where("type", "==", "event").where("authorUid", "==", uid)` 복합 쿼리는 Firestore 콘솔에서 첫 배포 후 복합 색인 생성이 필요할 수 있다 (에러 로그에 색인 생성 링크가 뜨면 그 링크로 생성). 기존 `stats.js`도 동일한 컬렉션에 `where`+`orderBy` 복합 쿼리를 이미 사용 중이므로 이 프로젝트에서 이미 익숙한 패턴이다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test index.test.js`
Expected: PASS (all prior + 5 new tests)

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: award attendance/schedule/full-house trophies on stats/global writes"
```

---

## Task 3: `game_scores` 트리거 — 2048 간판왕 트로피 판정

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Consumes: `checkGame2048Trophy`, `newlyEarnedTrophyIds` (Task 1), `awardTrophies` (Task 2, internal helper — reused as-is)
- Produces:
  - `isTopScorer(allScores, uid)`: `boolean` — `allScores: Array<{uid, bestScore}>` 중 `uid`가 최고 `bestScore` 보유자인지 (동점자는 모두 top으로 인정)
  - Firestore 트리거: `exports.onGameScoreUpdated` (`onDocumentWritten("game_scores/{uid}", ...)`)

- [ ] **Step 1: Write the failing tests**

```js
// functions/index.test.js 에 추가
const { isTopScorer } = require("./index.js");

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test index.test.js`
Expected: FAIL with `isTopScorer is not a function`

- [ ] **Step 3: Write the implementation**

Add to `functions/index.js` (near the other trophy helpers), and update the import from `trophies.js` to include `checkGame2048Trophy`:

```js
const {
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  newlyEarnedTrophyIds
} = require("./trophies.js");
```

```js
function isTopScorer(allScores, uid) {
  if (!allScores.length) return false;
  const top = Math.max(...allScores.map((s) => s.bestScore || 0));
  if (top === 0) return false;
  const mine = allScores.find((s) => s.uid === uid);
  return !!mine && (mine.bestScore || 0) === top;
}

exports.onGameScoreUpdated = onDocumentWritten("game_scores/{uid}", async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;
  if (!afterData) return;

  const uid = event.params.uid;
  const db = getFirestore();

  try {
    const scoresSnap = await db.collection("game_scores").get();
    const allScores = scoresSnap.docs.map((d) => ({ uid: d.id, bestScore: d.data().bestScore || 0 }));
    const candidates = checkGame2048Trophy(isTopScorer(allScores, uid));
    await awardTrophies(db, uid, candidates);
  } catch (err) {
    logger.error(`2048 트로피 판정 실패 (uid: ${uid})`, err);
  }
});

exports.isTopScorer = isTopScorer;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test index.test.js`
Expected: PASS (all prior + 3 new tests)

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: award 2048 champion trophy on game_scores writes"
```

---

## Task 4: 클라이언트 트로피 메타 모듈

**Files:**
- Create: `assets/js/trophies-meta.js`
- Test: `assets/js/trophies-meta.test.mjs`

**Interfaces:**
- Produces: `TROPHIES_META`: `Array<{ id: string, name: string, description: string, image: string }>` — Task 1의 `TROPHIES`와 내용이 동일해야 함 (별도 런타임/배포 단위라 코드 공유 불가, 값만 동기화 유지)

- [ ] **Step 1: Write the failing test**

```js
// assets/js/trophies-meta.test.mjs
import assert from "node:assert";
import { test } from "node:test";
import { TROPHIES_META } from "./trophies-meta.js";

test("TROPHIES_META: 5개 트로피, 각각 id/name/description/image 보유", () => {
  assert.strictEqual(TROPHIES_META.length, 5);
  TROPHIES_META.forEach((t) => {
    assert.ok(typeof t.id === "string" && t.id.length > 0);
    assert.ok(typeof t.name === "string" && t.name.length > 0);
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    assert.strictEqual(t.image, `/assets/trophies/${t.id}.png`);
  });
});

test("TROPHIES_META: id 목록이 functions/trophies.js와 동일하다", () => {
  const ids = TROPHIES_META.map((t) => t.id).sort();
  assert.deepStrictEqual(ids, [
    "full-house-king",
    "game-2048-champion",
    "kongz-regular",
    "kongz-veteran",
    "schedule-maker"
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test assets/js/trophies-meta.test.mjs`
Expected: FAIL with `Could not find './trophies-meta.js'`

- [ ] **Step 3: Write the implementation**

```js
// assets/js/trophies-meta.js
export const TROPHIES_META = [
  {
    id: "kongz-regular",
    name: "콩즈 죽돌이",
    description: "누적 출석 10회 달성",
    image: "/assets/trophies/kongz-regular.png"
  },
  {
    id: "kongz-veteran",
    name: "콩즈 개근왕",
    description: "누적 출석 30회 달성",
    image: "/assets/trophies/kongz-veteran.png"
  },
  {
    id: "schedule-maker",
    name: "일정 메이커",
    description: "누적 게시글 10개 등록",
    image: "/assets/trophies/schedule-maker.png"
  },
  {
    id: "full-house-king",
    name: "만석 달성왕",
    description: "본인이 등록한 이벤트 만석 5회 달성",
    image: "/assets/trophies/full-house-king.png"
  },
  {
    id: "game-2048-champion",
    name: "2048 간판왕",
    description: "2048 게임 전체 랭킹 1위 달성",
    image: "/assets/trophies/game-2048-champion.png"
  }
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test assets/js/trophies-meta.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add assets/js/trophies-meta.js assets/js/trophies-meta.test.mjs
git commit -m "feat: add client-side trophy metadata module"
```

---

## Task 5: 마이페이지 UI — 트로피 그리드 마크업 + 스타일

**Files:**
- Modify: `mypage.html`
- Modify: `assets/css/pages.css`

**Interfaces:**
- Consumes: 없음 (순수 마크업/CSS, Task 6에서 JS가 채움)
- Produces: DOM 요소 `#trophy-grid` (Task 6이 `innerHTML`로 채움), CSS 클래스 `.trophy-item`, `.trophy-item--locked`

이 태스크는 순수 마크업/CSS라 자동화된 단위 테스트 대상이 아니다. 브라우저에서 육안 확인으로 검증한다.

- [ ] **Step 1: `mypage.html`에 `game.css` 링크 추가** (`.victory-overlay` 재사용을 위해)

`mypage.html:6` 다음 줄에 추가:

```html
<link rel="stylesheet" href="/assets/css/pages.css">
<link rel="stylesheet" href="/assets/css/game.css">
```

- [ ] **Step 2: 트로피 섹션 마크업 추가**

`mypage.html`의 `<hr style="margin:24px 0">` (현재 81번째 줄) 바로 앞, `#section-parties` 닫는 `</div>` 뒤에 추가:

```html
<div id="section-trophies" class="mb-4">
  <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:8px">보유 트로피</div>
  <div id="trophy-grid"></div>
</div>
```

- [ ] **Step 3: `pages.css`에 트로피 그리드 스타일 추가**

파일 끝에 추가:

```css
#trophy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 12px;
}

.trophy-item img {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  margin: 0 auto;
}

.trophy-item--locked img {
  filter: grayscale(100%);
  opacity: 0.35;
}

.trophy-item {
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-muted);
}
```

- [ ] **Step 4: Commit**

```bash
git add mypage.html assets/css/pages.css
git commit -m "feat: add trophy grid markup and styles to mypage"
```

---

## Task 6: 마이페이지 JS — 트로피 그리드 렌더링 + 미확인 팝업

**Files:**
- Modify: `assets/js/mypage.js`

**Interfaces:**
- Consumes:
  - `TROPHIES_META` from `assets/js/trophies-meta.js` (Task 4)
  - `userData.trophies`: `Array<{id, earnedAt, seen}>` — Firestore `users/{uid}` 문서 필드 (Task 2/3이 기록)
  - `.victory-overlay` CSS class (기존 `game.css`, Task 5에서 링크 추가)
  - Firestore `updateDoc`, `doc` (이미 `mypage.js` 상단에서 일부 import됨 — `updateDoc` 추가 필요)
- Produces: 없음 (최종 소비 지점)

- [ ] **Step 1: import 추가**

`assets/js/mypage.js` 최상단 import 블록을 수정:

```js
import { auth, db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import { deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, deleteDoc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { computeAverages, computeKongzTemp, tempToColor } from "./rating-logic.js";
import { listMyParties, createParty, updateParty, deleteParty, listApprovedUsers } from "./party.js";
import { filterByNickname } from "./party-logic.js";
import { TROPHIES_META } from "./trophies-meta.js";
```

- [ ] **Step 2: 트로피 그리드 렌더링 함수 추가**

`assets/js/mypage.js`에서 `escapePartyText` 함수 뒤(파일 끝)에 추가:

```js
function renderTrophyGrid(earnedTrophies) {
  const earnedIds = new Set(earnedTrophies.map((t) => t.id));
  const el = document.getElementById("trophy-grid");
  el.innerHTML = TROPHIES_META.map((t) => {
    const locked = !earnedIds.has(t.id);
    return `
      <div class="trophy-item ${locked ? "trophy-item--locked" : ""}" title="${escapePartyText(t.name)} - ${escapePartyText(t.description)}">
        <img src="${t.image}" alt="${escapePartyText(t.name)}">
        <div>${escapePartyText(t.name)}</div>
      </div>
    `;
  }).join("");
}

async function showUnseenTrophyPopups(user, earnedTrophies) {
  const unseen = earnedTrophies.filter((t) => !t.seen);
  if (!unseen.length) return;

  for (const trophy of unseen) {
    const meta = TROPHIES_META.find((m) => m.id === trophy.id);
    if (!meta) continue;
    await showTrophyPopupAndWait(meta);
  }

  const updated = earnedTrophies.map((t) => ({ ...t, seen: true }));
  await updateDoc(doc(db, "users", user.uid), { trophies: updated });
}

function showTrophyPopupAndWait(meta) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "victory-overlay";
    el.innerHTML = `<img src="${meta.image}" alt=""><p>${escapePartyText(meta.name)} 획득!</p>`;
    document.body.appendChild(el);
    el.addEventListener("animationend", (e) => {
      if (e.target === el) {
        el.remove();
        resolve();
      }
    });
  });
}
```

- [ ] **Step 3: `requireApproved` 콜백에서 호출 연결**

`assets/js/mypage.js`의 `requireApproved(async (user, userData) => { ... })` 블록 내부, `await setupParties(user);` 다음 줄에 추가:

```js
  const earnedTrophies = userData.trophies || [];
  renderTrophyGrid(earnedTrophies);
  await showUnseenTrophyPopups(user, earnedTrophies);
```

- [ ] **Step 4: 브라우저에서 수동 확인**

Firestore 콘솔에서 테스트 계정의 `users/{uid}` 문서에 다음 필드를 임시로 추가:

```json
"trophies": [
  { "id": "kongz-regular", "earnedAt": "2026-07-15T00:00:00Z", "seen": false }
]
```

`/mypage/` 접속 → 팝업이 뜨고, 팝업 종료 후 그리드에 "콩즈 죽돌이"가 컬러로 표시되는지, 나머지 4개는 흑백/반투명으로 표시되는지 확인. 새로고침 시 팝업이 다시 뜨지 않는지 확인 (Firestore 문서의 `seen`이 `true`로 바뀌어 있어야 함).

- [ ] **Step 5: Commit**

```bash
git add assets/js/mypage.js
git commit -m "feat: render trophy grid and show one-time popup for newly earned trophies"
```

---

## Task 7: 통합 확인 — Cloud Functions 배포 전 로컬 검증

**Files:** 없음 (검증 전용 태스크)

**Interfaces:** 없음

- [ ] **Step 1: 전체 functions 테스트 실행**

Run: `cd functions && node --test`
Expected: 모든 테스트 PASS (기존 테스트 + Task 1~3에서 추가한 트로피 관련 테스트)

- [ ] **Step 2: 전체 클라이언트 테스트 실행**

Run: `node --test assets/js/*.test.mjs`
Expected: 모든 테스트 PASS (`party-logic.test.mjs`, `trophies-meta.test.mjs` 등)

- [ ] **Step 3: `functions/trophies.js`와 `assets/js/trophies-meta.js`의 id 목록이 일치하는지 확인**

```bash
node -e "
const { TROPHIES } = require('./functions/trophies.js');
console.log(TROPHIES.map(t => t.id).sort().join(','));
"
node -e "
import('./assets/js/trophies-meta.js').then(m => {
  console.log(m.TROPHIES_META.map(t => t.id).sort().join(','));
});
"
```

Expected: 두 출력이 동일한 정렬된 id 목록.

- [ ] **Step 4: Commit (변경사항 있을 경우에만)**

이 태스크는 검증 전용이라 코드 변경이 없다면 커밋하지 않는다.

---

## Out of Scope (spec과 동일)

- 실시간 팝업 (조건 달성 즉시) — 다음 페이지 로드 시 확인 방식으로 대체
- 월별 출석 트로피 — 월별 집계 인프라 없음
- 관리자 트로피 편집 UI
- 트로피 이미지 파일 실제 제작 (`/assets/trophies/*.png` 5개 파일은 이 플랜 범위 밖 — 파일이 없으면 `<img>`가 깨진 아이콘으로 표시되지만 기능은 정상 동작)
