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
