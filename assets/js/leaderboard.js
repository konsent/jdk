import { db } from "./firebase-init.js";
import { escapeHtml } from "./utils.js";
import { weekKey } from "./suika-logic.js";
import { TOP_N, rankWeekly, myRankIndex, countAhead } from "./leaderboard-logic.js";
import {
  doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 2048 과 콩드랍이 통째로 복제해 쓰던 리더보드 로직을 한 곳으로 합쳤다.
// 두 게임은 최고점 필드 이름만 다르다(2048: bestScore, 콩드랍: best).

const TROPHIES = ["🥇", "🥈", "🥉"];

function rankClass(i) { return i < 3 ? `rank-${i + 1}` : ""; }
function trophy(i) { return i < 3 ? ` <span class="leaderboard-trophy">${TROPHIES[i]}</span>` : ""; }

/**
 * 최고 점수를 갱신한다. 기존 기록보다 낮으면 최고점은 그대로 두고 주간 기록만 반영한다.
 * @param {{collectionName: string, bestField: string}} config
 */
export async function submitScore(config, uid, nickname, finalScore) {
  const ref = doc(db, config.collectionName, uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : {};
  const wk = weekKey(new Date());
  await setDoc(ref, {
    nickname,
    [config.bestField]: Math.max(prev[config.bestField] || 0, finalScore),
    weekBest: prev.weekKey === wk ? Math.max(prev.weekBest || 0, finalScore) : finalScore,
    weekKey: wk,
    updatedAt: serverTimestamp()
  });
}

/**
 * 상위 10명만 서버에서 정렬해 받아온다.
 * 예전에는 컬렉션 전체를 받아 클라이언트에서 잘랐다 — 회원이 늘수록 그대로 비용이 됐다.
 * 주간 탭과 "내 순위"는 전체 순위가 필요하므로 그때만 전량 조회한다.
 */
async function fetchEntries(config, tab, currentUid) {
  const wk = weekKey(new Date());

  // 전체 탭 + 내 기록이 top10 안에 있는 흔한 경우: 10건만 읽으면 끝난다.
  if (tab === "all") {
    const topSnap = await getDocs(query(
      collection(db, config.collectionName),
      orderBy(config.bestField, "desc"),
      limit(TOP_N)
    ));
    const top = topSnap.docs.map((d) => ({ uid: d.id, ...d.data(), value: d.data()[config.bestField] || 0 }));
    const myIndex = top.findIndex((e) => e.uid === currentUid);
    if (myIndex !== -1) return { top, myIndex, myValue: top[myIndex].value };

    // 내가 top10 밖이면 내 점수만 따로 읽어 순위를 센다.
    const mySnap = await getDoc(doc(db, config.collectionName, currentUid));
    if (!mySnap.exists()) return { top, myIndex: -1, myValue: 0 };
    const myValue = mySnap.data()[config.bestField] || 0;
    const aheadSnap = await getDocs(query(
      collection(db, config.collectionName),
      orderBy(config.bestField, "desc")
    ));
    const ahead = countAhead(aheadSnap.docs.map((d) => d.data()), config.bestField, myValue);
    return { top, myIndex: ahead, myValue };
  }

  // 주간 탭: weekKey 로 걸러야 해서 전량 조회가 불가피하다.
  const snap = await getDocs(collection(db, config.collectionName));
  const entries = rankWeekly(snap.docs.map((d) => ({ uid: d.id, ...d.data() })), wk);
  const myIndex = myRankIndex(entries, currentUid);
  return {
    top: entries.slice(0, TOP_N),
    myIndex,
    myValue: myIndex === -1 ? 0 : entries[myIndex].value
  };
}

/** 전체 1위 점수 — "신기록" 축하 연출 판정에 쓴다. */
export async function fetchTopScore(config) {
  const snap = await getDocs(query(
    collection(db, config.collectionName),
    orderBy(config.bestField, "desc"),
    limit(1)
  ));
  return snap.empty ? 0 : (snap.docs[0].data()[config.bestField] || 0);
}

export async function renderLeaderboard(config, tab, currentUid) {
  const listEl = document.getElementById("leaderboard-list");
  const myRankEl = document.getElementById("my-rank");
  try {
    const { top, myIndex, myValue } = await fetchEntries(config, tab, currentUid);

    listEl.innerHTML = top.length
      ? top.map((e, i) => `
          <div class="leaderboard-row ${rankClass(i)} ${e.uid === currentUid ? "is-me" : ""}">
            <span><span class="leaderboard-rank">${i + 1}</span>${escapeHtml(e.nickname)}${trophy(i)}</span>
            <span>${Number(e.value) || 0}</span>
          </div>`).join("")
      : `<p class="text-muted small">아직 기록이 없습니다.</p>`;

    if (myRankEl) {
      myRankEl.textContent = myIndex === -1
        ? "아직 기록이 없습니다"
        : `내 순위: ${myIndex + 1}위 (최고 ${myValue}점)`;
    }
  } catch (err) {
    console.error("리더보드 조회 실패", err);
    listEl.textContent = "리더보드를 불러오지 못했습니다.";
    if (myRankEl) myRankEl.textContent = "";
  }
}

/** 전체/주간 탭 버튼을 연결한다. */
export function setupLeaderboardTabs(onChange) {
  const allBtn = document.getElementById("lb-tab-all");
  const weekBtn = document.getElementById("lb-tab-week");
  const select = (tab) => {
    allBtn.classList.toggle("active", tab === "all");
    weekBtn.classList.toggle("active", tab === "week");
    onChange(tab);
  };
  allBtn.addEventListener("click", () => select("all"));
  weekBtn.addEventListener("click", () => select("week"));
}
