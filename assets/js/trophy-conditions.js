export function checkAttendanceTrophies(attendCount) {
  const ids = [];
  if (attendCount >= 10) ids.push("kongz-regular");
  if (attendCount >= 30) ids.push("kongz-veteran");
  if (attendCount >= 50) ids.push("paju-ghost-1");
  if (attendCount >= 75) ids.push("paju-ghost-2");
  if (attendCount >= 100) ids.push("paju-ghost-3");
  return ids;
}

export function checkScheduleMakerTrophy(postCount) {
  return postCount >= 10 ? ["schedule-maker"] : [];
}

export function checkFullHouseTrophy(fullCount) {
  return fullCount >= 5 ? ["full-house-king"] : [];
}

export function checkWritingMasterTrophy(postCount) {
  return postCount >= 30 ? ["writing-master"] : [];
}

export function checkHeartthrobTrophy(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count < 10) return [];
  const sum = memberStats.ratingSum || {};
  const avg = ((sum.manner || 0) + (sum.skill || 0) + (sum.again || 0)) / 3 / count;
  return avg >= 4.5 ? ["heartthrob"] : [];
}

export function computeKongzTempServer(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count === 0) return { temp: 36.5, count: 0 };
  const sum = memberStats.ratingSum || {};
  const weighted = (sum.manner || 0) * 0.25 + (sum.skill || 0) * 0.25 + (sum.again || 0) * 0.5;
  const avg = weighted / count;
  const temp = Math.round((36.5 + (avg - 3) * 13) * 10) / 10;
  return { temp, count };
}

export function checkKongzTempTrophies(memberStats) {
  const { temp } = computeKongzTempServer(memberStats);
  const ids = [];
  if (temp >= 60) ids.push("kongz-hot");
  if (temp >= 62) ids.push("so-hot");
  return ids;
}

export function checkGame2048Trophy(isTopScorer) {
  return isTopScorer ? ["game-2048-champion"] : [];
}

export function checkAnnualMemberTrophy(annualMember) {
  return annualMember === true ? ["annual-member"] : [];
}

export function checkSuikaMasterTrophy(isTopScorer) {
  return isTopScorer ? ["suika-master"] : [];
}

export function checkPartyPlannerTrophy(partyCount) {
  return partyCount >= 3 ? ["party-planner"] : [];
}

export function checkNoNoshowTrophy(confirmedEventCount) {
  return confirmedEventCount >= 20 ? ["no-noshow-20"] : [];
}

export function checkWeekendRegularTrophy(weekendConfirmedCount) {
  return weekendConfirmedCount >= 10 ? ["weekend-regular"] : [];
}

export function hasConsecutiveDays(dateList, n) {
  if (!dateList.length) return false;
  const dayKeys = [...new Set(
    dateList.map((d) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      return dt.getTime();
    })
  )].sort((a, b) => a - b);

  let streak = 1;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (let i = 1; i < dayKeys.length; i++) {
    if (dayKeys[i] - dayKeys[i - 1] === ONE_DAY) {
      streak++;
      if (streak >= n) return true;
    } else {
      streak = 1;
    }
  }
  return streak >= n;
}

export function checkFiveDayStreakTrophy(hasStreak) {
  return hasStreak ? ["five-day-streak"] : [];
}

export function newlyEarnedTrophyIds(existingIds, candidateIds) {
  return candidateIds.filter((id) => !existingIds.includes(id));
}
