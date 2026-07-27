# 게임 전체 1위 트로피 수여 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2048와 콩드랍의 현재·향후 전체 1위가 영구 트로피를 받고, 현재 누락된 1위도 관리자 백필로 수여할 수 있게 한다.

**Architecture:** Cloud Functions의 점수 변경 트리거는 공통 최고점 판정 함수와 게임별 점수 정규화를 사용해 변경한 회원이 전체 최고점인지 확인한 뒤 기존 `awardTrophies`로 멱등 수여한다. 관리자 백필은 동일한 최고점 판정 규칙으로 현재 두 게임의 누락 수상자를 추가한다. 내 정보 페이지는 기존 `users/{uid}.trophies` 렌더링을 그대로 사용한다.

**Tech Stack:** Firebase Cloud Functions v2, Cloud Firestore, vanilla JavaScript ES modules, Node.js `node:test`/`node:assert`.

## Global Constraints

- `game_scores`는 `bestScore`, `suika_scores`는 `best`를 전체 최고점의 기준으로 사용한다.
- 동점 최고 기록자 모두 수여 대상이며, 0점은 수여하지 않는다.
- 트로피는 영구 보존한다. 기존 수상자의 트로피를 삭제하거나 다른 회원이 새 1위가 됐다는 이유로 회수하지 않는다.
- 같은 `{ id }` 트로피는 한 사용자에게 한 번만 기록한다. 신규 기록은 `{ id, earnedAt: new Date(), seen: false }` 형태를 유지한다.
- 현재 누락 수상자는 `stats.html`의 기존 “트로피 소급 재계산”을 실행해 수여한다.
- 테스트는 Node 내장 `node:test`와 `node:assert`만 사용하며, Firestore 연결을 요구하지 않는다.

---

## File Structure

- Modify: `functions/index.js` — 점수 컬렉션을 공통 점수 배열로 변환하고 전체 1위 uid를 판정하는 순수 함수를 노출하며, 두 Firestore 트리거가 이를 사용하도록 통일한다.
- Modify: `functions/index.test.js` — 2048/콩드랍의 단독·공동 1위, 0점 제외, 스키마 정규화와 트로피 후보를 회귀 테스트한다.
- Modify: `assets/js/stats.js` — 백필에 쓰이는 현재 게임 1위 판정을 내보내기 쉬운 순수 헬퍼로 분리하고 두 게임의 후보 생성을 그 헬퍼로 통일한다.
- Modify: `assets/js/stats.test.mjs` — 백필 헬퍼가 2048와 콩드랍의 현재 최고점자만 후보로 만들고, 기존 보유 항목을 제외하는지 확인한다.

### Task 1: 서버 점수 1위 판정 통일

**Files:**
- Modify: `functions/index.js:269-318`
- Modify: `functions/index.test.js`

**Interfaces:**
- Consumes: `game_scores` 문서의 `{ bestScore }`, `suika_scores` 문서의 `{ best }`, `checkGame2048Trophy(isTopScorer)`, `checkSuikaMasterTrophy(isTopScorer)`.
- Produces: `mapGameScores(docs) => Array<{uid: string, bestScore: number}>`, `mapSuikaScores(docs) => Array<{uid: string, bestScore: number}>`, `isTopScorer(allScores, uid) => boolean`.

- [ ] **Step 1: Write the failing server tests**

  Add to `functions/index.test.js` after the existing trophy tests:

  ```js
  const {
    isTopScorer,
    mapGameScores,
    mapSuikaScores
  } = require("./index.js");
  const {
    checkGame2048Trophy,
    checkSuikaMasterTrophy,
    newlyEarnedTrophyIds
  } = require("./trophies.js");

  test("게임 점수 변환: 2048과 콩드랍 스키마를 같은 최고점 형식으로 바꾼다", () => {
    assert.deepStrictEqual(
      mapGameScores([{ id: "a", bestScore: 120 }, { id: "b", bestScore: 90 }]),
      [{ uid: "a", bestScore: 120 }, { uid: "b", bestScore: 90 }]
    );
    assert.deepStrictEqual(
      mapSuikaScores([{ id: "a", best: 120 }, { id: "b", best: 90 }]),
      [{ uid: "a", bestScore: 120 }, { uid: "b", bestScore: 90 }]
    );
  });

  test("게임 전체 1위: 단독·공동 1위만 수여 후보이고 0점은 제외한다", () => {
    const scores = [{ uid: "a", bestScore: 120 }, { uid: "b", bestScore: 120 }, { uid: "c", bestScore: 90 }];
    assert.strictEqual(isTopScorer(scores, "a"), true);
    assert.strictEqual(isTopScorer(scores, "b"), true);
    assert.strictEqual(isTopScorer(scores, "c"), false);
    assert.strictEqual(isTopScorer([{ uid: "a", bestScore: 0 }], "a"), false);
    assert.deepStrictEqual(checkGame2048Trophy(isTopScorer(scores, "a")), ["game-2048-champion"]);
    assert.deepStrictEqual(checkSuikaMasterTrophy(isTopScorer(scores, "b")), ["suika-master"]);
  });

  test("게임 전체 1위: 이미 수여한 트로피는 다시 기록하지 않는다", () => {
    assert.deepStrictEqual(
      newlyEarnedTrophyIds(["game-2048-champion", "suika-master"], ["game-2048-champion", "suika-master"]),
      []
    );
  });
  ```

- [ ] **Step 2: Run the server tests to verify the first test fails**

  Run: `node --test functions/index.test.js`

  Expected: FAIL with `mapGameScores is not a function`.

- [ ] **Step 3: Implement the smallest shared score mapper**

  In `functions/index.js`, directly before `isTopScorer`, add and export:

  ```js
  function mapGameScores(docs) {
    return docs.map((d) => ({ uid: d.id, bestScore: d.bestScore || 0 }));
  }

  function mapSuikaScores(docs) {
    return docs.map((d) => ({ uid: d.id, bestScore: d.best || 0 }));
  }

  exports.mapGameScores = mapGameScores;
  exports.mapSuikaScores = mapSuikaScores;
  ```

  Update `onGameScoreUpdated` and `onSuikaScoreUpdated` to pass `scoresSnap.docs.map((d) => ({ id: d.id, ...d.data() }))` to their respective mapper. Keep the existing `isTopScorer` zero-score guard and `awardTrophies` call unchanged.

- [ ] **Step 4: Run the server tests to verify they pass**

  Run: `node --test functions/index.test.js functions/trophies.test.js`

  Expected: PASS with all tests passing.

- [ ] **Step 5: Commit the server behavior and regression tests**

  ```bash
  git add functions/index.js functions/index.test.js
  git commit -m "fix: award game leaderboard trophies reliably"
  ```

### Task 2: 백필의 게임 1위 후보를 테스트 가능한 헬퍼로 고정

**Files:**
- Modify: `assets/js/stats.js:280-332`
- Create: `assets/js/stats.test.mjs`

**Interfaces:**
- Consumes: `checkGame2048Trophy(isTopScorer)`, `checkSuikaMasterTrophy(isTopScorer)`, `newlyEarnedTrophyIds(existingIds, candidateIds)` from `assets/js/trophy-conditions.js`.
- Produces: `gameLeaderboardTrophyCandidates(gameScores, suikaScores, uid) => string[]`; it returns `game-2048-champion` and/or `suika-master` only when `uid` matches a non-zero highest record in the respective collection.

- [ ] **Step 1: Write the failing backfill helper tests**

  Create `assets/js/stats.test.mjs`:

  ```js
  import assert from "node:assert";
  import { test } from "node:test";
  import { gameLeaderboardTrophyCandidates } from "./stats.js";

  test("게임 백필 후보: 두 게임의 현재 단독 1위에게 각각 트로피를 만든다", () => {
    assert.deepStrictEqual(
      gameLeaderboardTrophyCandidates(
        [{ uid: "2048-top", bestScore: 100 }, { uid: "other", bestScore: 99 }],
        [{ uid: "suika-top", best: 200 }, { uid: "other", best: 199 }],
        "2048-top"
      ),
      ["game-2048-champion"]
    );
    assert.deepStrictEqual(
      gameLeaderboardTrophyCandidates(
        [{ uid: "2048-top", bestScore: 100 }],
        [{ uid: "suika-top", best: 200 }],
        "suika-top"
      ),
      ["suika-master"]
    );
  });

  test("게임 백필 후보: 공동 1위는 포함하고 0점과 비1위는 제외한다", () => {
    const games = [{ uid: "a", bestScore: 100 }, { uid: "b", bestScore: 100 }, { uid: "c", bestScore: 10 }];
    assert.deepStrictEqual(gameLeaderboardTrophyCandidates(games, [], "a"), ["game-2048-champion"]);
    assert.deepStrictEqual(gameLeaderboardTrophyCandidates(games, [], "b"), ["game-2048-champion"]);
    assert.deepStrictEqual(gameLeaderboardTrophyCandidates(games, [], "c"), []);
    assert.deepStrictEqual(gameLeaderboardTrophyCandidates([{ uid: "zero", bestScore: 0 }], [{ uid: "zero", best: 0 }], "zero"), []);
  });
  ```

- [ ] **Step 2: Run the backfill test to verify it fails**

  Run: `node --test assets/js/stats.test.mjs`

  Expected: FAIL with `does not provide an export named 'gameLeaderboardTrophyCandidates'`.

- [ ] **Step 3: Implement the pure backfill helper and use it**

  In `assets/js/stats.js`, add this named export near the existing trophy candidate functions:

  ```js
  export function gameLeaderboardTrophyCandidates(gameScores, suikaScores, uid) {
    const isTop = (scores, key) => {
      const top = Math.max(0, ...scores.map((score) => score[key] || 0));
      return top > 0 && scores.some((score) => score.uid === uid && (score[key] || 0) === top);
    };
    return [
      ...checkGame2048Trophy(isTop(gameScores, "bestScore")),
      ...checkSuikaMasterTrophy(isTop(suikaScores, "best"))
    ];
  }
  ```

  Replace the two inline game-top candidate expressions in the loop inside `runTrophyBackfill` with:

  ```js
  ...gameLeaderboardTrophyCandidates(gameScores, suikaScores, uid),
  ```

  Preserve the existing `newlyEarnedTrophyIds` filtering and `arrayUnion(...entries)` write; those make the manual backfill safe to execute repeatedly.

- [ ] **Step 4: Run all relevant tests to verify they pass**

  Run: `node --test assets/js/stats.test.mjs assets/js/trophy-conditions-parity.test.mjs assets/js/mypage-logic.test.mjs`

  Expected: PASS with all tests passing.

- [ ] **Step 5: Commit the safe backfill path**

  ```bash
  git add assets/js/stats.js assets/js/stats.test.mjs
  git commit -m "fix: backfill missing game leaderboard trophies"
  ```

### Task 3: 배포 및 현재 1위 소급 수여

**Files:**
- No repository file changes.

**Interfaces:**
- Consumes: deployed `onGameScoreUpdated` and `onSuikaScoreUpdated`, the administrator-only existing “트로피 소급 재계산” button in `stats.html`.
- Produces: a `users/{uid}.trophies` entry for every current 2048/콩드랍 non-zero overall top scorer who did not already have it.

- [ ] **Step 1: Verify the final repository test suite before deployment**

  Run:

  ```bash
  node --test functions/*.test.js
  node --test assets/js/*.test.mjs
  ```

  Expected: PASS with no failures.

- [ ] **Step 2: Deploy the Firestore triggers**

  Run:

  ```bash
  firebase deploy --only functions:onGameScoreUpdated,functions:onSuikaScoreUpdated
  ```

  Expected: Firebase reports both function deployments as successful.

- [ ] **Step 3: Run the existing administrator backfill action once**

  Sign in as an approved administrator, open `/stats/`, select “트로피 소급 재계산”, and confirm the dialog. Verify the result message reports any newly awarded trophies without failures.

- [ ] **Step 4: Verify the two current leaders' profile pages**

  For each current 2048 and 콩드랍 non-zero overall leader, open `/mypage/` while signed in as that user. Confirm the appropriate `2048 간판왕` or `콩드랍 마스터` image is not grayscale/locked and any unseen trophy popup is shown once.

- [ ] **Step 5: Commit status**

  No commit is required for deployment or the Firestore backfill. Record the Firebase deployment version and backfill result in the release handoff.
