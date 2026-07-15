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
  },
  {
    id: "paju-ghost-1",
    name: "파주 귀신 I",
    description: "누적 출석 50회 달성",
    image: "/assets/trophies/paju-ghost-1.png"
  },
  {
    id: "paju-ghost-2",
    name: "파주 귀신 II",
    description: "누적 출석 75회 달성",
    image: "/assets/trophies/paju-ghost-2.png"
  },
  {
    id: "paju-ghost-3",
    name: "파주 귀신 III",
    description: "누적 출석 100회 달성",
    image: "/assets/trophies/paju-ghost-3.png"
  },
  {
    id: "writing-master",
    name: "글쓰기 장인",
    description: "누적 게시글 30개 등록",
    image: "/assets/trophies/writing-master.png"
  },
  {
    id: "heartthrob",
    name: "인기 만점",
    description: "평균 평점 4.5 이상 (10회 이상 평가받음)",
    image: "/assets/trophies/heartthrob.png"
  },
  {
    id: "kongz-hot",
    name: "콩즈 온도왕",
    description: "콩즈 온도 60도 이상 달성",
    image: "/assets/trophies/kongz-hot.png"
  },
  {
    id: "so-hot",
    name: "쏘핫",
    description: "콩즈 온도 62도 이상 달성",
    image: "/assets/trophies/so-hot.png"
  }
];

function checkAttendanceTrophies(attendCount) {
  const ids = [];
  if (attendCount >= 10) ids.push("kongz-regular");
  if (attendCount >= 30) ids.push("kongz-veteran");
  if (attendCount >= 50) ids.push("paju-ghost-1");
  if (attendCount >= 75) ids.push("paju-ghost-2");
  if (attendCount >= 100) ids.push("paju-ghost-3");
  return ids;
}

function checkScheduleMakerTrophy(postCount) {
  return postCount >= 10 ? ["schedule-maker"] : [];
}

function checkFullHouseTrophy(fullCount) {
  return fullCount >= 5 ? ["full-house-king"] : [];
}

function checkWritingMasterTrophy(postCount) {
  return postCount >= 30 ? ["writing-master"] : [];
}

function checkHeartthrobTrophy(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count < 10) return [];
  const sum = memberStats.ratingSum || {};
  const avg = ((sum.manner || 0) + (sum.skill || 0) + (sum.again || 0)) / 3 / count;
  return avg >= 4.5 ? ["heartthrob"] : [];
}

function computeKongzTempServer(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count === 0) return { temp: 36.5, count: 0 };
  const sum = memberStats.ratingSum || {};
  const weighted = (sum.manner || 0) * 0.25 + (sum.skill || 0) * 0.25 + (sum.again || 0) * 0.5;
  const avg = weighted / count;
  const temp = Math.round((36.5 + (avg - 3) * 13) * 10) / 10;
  return { temp, count };
}

function checkKongzTempTrophies(memberStats) {
  const { temp } = computeKongzTempServer(memberStats);
  const ids = [];
  if (temp >= 60) ids.push("kongz-hot");
  if (temp >= 62) ids.push("so-hot");
  return ids;
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
  checkWritingMasterTrophy,
  checkHeartthrobTrophy,
  computeKongzTempServer,
  checkKongzTempTrophies,
  newlyEarnedTrophyIds
};
