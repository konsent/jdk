// 순수 로직 모듈 — DOM/Matter.js 의존 없음 (게임 규칙은 스펙 문서 참조)
export const TIERS = [
  { tier: 1, label: "d4",   radius: 14, color: "#e6a23c", score: 0,  image: "다소.jpg" },
  { tier: 2, label: "d6",   radius: 20, color: "#f56c6c", score: 3,  image: "2사분.jpg" },
  { tier: 3, label: "d8",   radius: 27, color: "#9b59b6", score: 6,  image: "도토.jpg" },
  { tier: 4, label: "d10",  radius: 35, color: "#3498db", score: 10, image: "카레.jpg" },
  { tier: 5, label: "d12",  radius: 44, color: "#1abc9c", score: 15, image: "그냥s.jpg" },
  { tier: 6, label: "d20",  radius: 54, color: "#2ecc71", score: 21, image: "임요.jpg" },
  { tier: 7, label: "d30",  radius: 65, color: "#f1c40f", score: 28, image: "오버쿡.jpg" },
  { tier: 8, label: "d100", radius: 78, color: "#e67e22", score: 36, image: "통사부.jpg" },
  { tier: 9, label: "콩",   radius: 92, color: "#8b5a2b", score: 66, image: "산도깨비.jpg" }
];

const MAX_DROP_TIER = 5;

export function getTier(tier) {
  return TIERS[tier - 1];
}

export function randomDropTier(rand = Math.random) {
  return Math.floor(rand() * MAX_DROP_TIER) + 1;
}

export function mergeResult(tier) {
  if (tier === TIERS.length) return { next: null, score: getTier(tier).score };
  return { next: tier + 1, score: getTier(tier + 1).score };
}

export function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
