// 순수 로직 모듈 — DOM/Matter.js 의존 없음 (게임 규칙은 스펙 문서 참조)
export const TIERS = [
  { tier: 1, label: "d4",   radius: 14, color: "#e6a23c", score: 0 },
  { tier: 2, label: "d6",   radius: 20, color: "#f56c6c", score: 3 },
  { tier: 3, label: "d8",   radius: 27, color: "#9b59b6", score: 6 },
  { tier: 4, label: "d10",  radius: 35, color: "#3498db", score: 10 },
  { tier: 5, label: "d12",  radius: 44, color: "#1abc9c", score: 15 },
  { tier: 6, label: "d20",  radius: 54, color: "#2ecc71", score: 21 },
  { tier: 7, label: "d30",  radius: 65, color: "#f1c40f", score: 28 },
  { tier: 8, label: "d100", radius: 78, color: "#e67e22", score: 36 },
  { tier: 9, label: "콩",   radius: 92, color: "#8b5a2b", score: 66 }
];

// 9단계 전부 매주(weekKey) 이미지 풀에서 시드 셔플로 재배정.
const HONOR_POOL = [
  "잠자는 사자.jpg", "나탄.jpg", "다소.jpg", "도토.jpg", "동원.jpg", "무지.jpg",
  "부산갈매기.jpg", "산도깨비.jpg", "오버쿡.jpg", "임요.jpg", "찰리.jpg", "카레.jpg",
  "캐스퍼.jpg", "통사부.jpg", "헨리에타쨩.jpg", "흑표범.jpg", "2사분.jpg",
  "hare.jpg", "그냥s.jpg", "sokim.jpg"
];

function seededRand(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

function shuffled(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function seasonImages(seasonKey) {
  const picks = shuffled(HONOR_POOL, seededRand(seasonKey));
  const images = {};
  TIERS.forEach((t, i) => { images[t.tier] = picks[i]; });
  return images;
}

const MAX_DROP_TIER = 5;

export function getTier(tier, seasonKey) {
  const base = TIERS[tier - 1];
  if (!seasonKey) return base;
  return { ...base, image: seasonImages(seasonKey)[tier] };
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
