export function getRatingTargets(postData, currentUid) {
  const targets = postData.confirmedAttendees || postData.attendees || [];
  return targets.filter((uid) => uid !== currentUid);
}

export function canRateNow(eventDate, closed = false, now = new Date()) {
  if (closed) return true;
  const cutoff = new Date(eventDate);
  cutoff.setHours(24, 0, 0, 0);
  return now.getTime() >= cutoff.getTime();
}

export function ratingDocId(postId, raterUid, targetUid) {
  return `${postId}_${raterUid}_${targetUid}`;
}

export function computeAverages(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count === 0) return { manner: null, skill: null, again: null, count: 0 };
  const round1 = (x) => Math.round(x * 10) / 10;
  const sum = memberStats.ratingSum || {};
  return {
    manner: round1((sum.manner || 0) / count),
    skill: round1((sum.skill || 0) / count),
    again: round1((sum.again || 0) / count),
    count
  };
}

export function computeKongzTemp(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count === 0) return { temp: 36.5, count: 0 };
  const sum = memberStats.ratingSum || {};
  const weighted = (sum.manner || 0) * 0.25 + (sum.skill || 0) * 0.25 + (sum.again || 0) * 0.5;
  const avg = weighted / count;
  const temp = Math.round((36.5 + (avg - 3) * 13) * 10) / 10;
  return { temp, count };
}
