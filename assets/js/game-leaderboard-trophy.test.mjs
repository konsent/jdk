import assert from "node:assert";
import { test } from "node:test";
import { gameLeaderboardTrophyCandidates } from "./game-leaderboard-trophy.js";

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
