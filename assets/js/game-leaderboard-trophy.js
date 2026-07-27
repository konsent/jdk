import { checkGame2048Trophy, checkSuikaMasterTrophy } from "./trophy-conditions.js";

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
