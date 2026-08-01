// 리더보드의 순수 계산 부분. Firestore/DOM 에 의존하지 않아 테스트가 가능하다.

export const TOP_N = 10;

/** 주간 탭용: 이번 주 기록만 남기고 점수순으로 정렬한다. */
export function rankWeekly(docs, currentWeekKey) {
  return docs
    .filter((e) => e.weekKey === currentWeekKey)
    .map((e) => ({ ...e, value: e.weekBest || 0 }))
    .sort((a, b) => b.value - a.value);
}

/** 전체 탭용: 최고점 필드로 정렬한다. */
export function rankAllTime(docs, bestField) {
  return docs
    .map((e) => ({ ...e, value: e[bestField] || 0 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * 내 순위(0-based). 기록이 없으면 -1.
 * 동점자가 있으면 같은 점수 중 가장 앞 순위를 준다.
 */
export function myRankIndex(ranked, uid) {
  return ranked.findIndex((e) => e.uid === uid);
}

/** 상위 몇 명이 나보다 점수가 높은지 — top10 밖의 내 순위를 셀 때 쓴다. */
export function countAhead(docs, bestField, myValue) {
  return docs.filter((e) => (e[bestField] || 0) > myValue).length;
}
