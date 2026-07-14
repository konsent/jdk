import { db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import { createEmptyGrid, addRandomTile, move, isGameOver } from "./game2048.js";
import { weekKey } from "./suika-logic.js";
import { showVictory } from "./victory.js";
import {
  doc, getDoc, setDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let grid = createEmptyGrid();
let score = 0;
let gameOver = false;
let currentUser = null;
let currentUserData = null;
let lbTab = "all";
let topScore = 0; // 전체 리더보드 1위 점수 (loadLeaderboard에서 갱신)

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const TROPHIES = ["🥇", "🥈", "🥉"];
function rankClass(i) { return i < 3 ? `rank-${i + 1}` : ""; }
function trophy(i) { return i < 3 ? ` <span class="leaderboard-trophy">${TROPHIES[i]}</span>` : ""; }

requireApproved((user, userData) => {
  currentUser = user;
  currentUserData = userData;
  startNewGame();
  loadLeaderboard();
});

function startNewGame() {
  grid = addRandomTile(addRandomTile(createEmptyGrid()));
  score = 0;
  gameOver = false;
  document.getElementById("game-over-msg").style.display = "none";
  render();
}

function render() {
  const gridEl = document.getElementById("game-grid");
  gridEl.innerHTML = "";
  grid.flat().forEach(value => {
    const tile = document.createElement("div");
    tile.className = "game-tile";
    tile.dataset.value = String(value);
    tile.textContent = value === 0 ? "" : String(value);
    gridEl.appendChild(tile);
  });
  document.getElementById("game-score").textContent = String(score);
}

function handleMove(direction) {
  if (gameOver) return;
  const result = move(grid, direction);
  if (!result.moved) return;

  grid = addRandomTile(result.grid);
  score += result.scoreGained;
  render();

  if (isGameOver(grid)) {
    gameOver = true;
    document.getElementById("game-over-msg").style.display = "block";
    if (score > topScore && score > 0) showVictory();
    submitScore(currentUser.uid, currentUserData.nickname, score)
      .then(loadLeaderboard);
  }
}

document.addEventListener("keydown", (e) => {
  const map = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down"
  };
  if (map[e.key]) {
    e.preventDefault();
    handleMove(map[e.key]);
  }
});

let touchStartX = 0;
let touchStartY = 0;
document.getElementById("game-grid").addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.getElementById("game-grid").addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    handleMove(dx > 0 ? "right" : "left");
  } else {
    handleMove(dy > 0 ? "down" : "up");
  }
});

document.getElementById("btn-restart").addEventListener("click", startNewGame);
document.getElementById("btn-restart-top").addEventListener("click", startNewGame);

async function submitScore(uid, nickname, finalScore) {
  const ref = doc(db, "game_scores", uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : {};
  const wk = weekKey(new Date());
  await setDoc(ref, {
    nickname,
    bestScore: Math.max(prev.bestScore || 0, finalScore),
    weekBest: prev.weekKey === wk ? Math.max(prev.weekBest || 0, finalScore) : finalScore,
    weekKey: wk,
    updatedAt: serverTimestamp()
  });
}

async function loadLeaderboard() {
  const snap = await getDocs(collection(db, "game_scores"));
  const all = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  topScore = all.reduce((m, e) => Math.max(m, e.bestScore || 0), 0);
  const wk = weekKey(new Date());
  const entries = (lbTab === "week"
    ? all.filter(e => e.weekKey === wk).map(e => ({ ...e, value: e.weekBest || 0 }))
    : all.map(e => ({ ...e, value: e.bestScore || 0 })))
    .sort((a, b) => b.value - a.value);

  const top10 = entries.slice(0, 10);
  const listEl = document.getElementById("leaderboard-list");
  listEl.innerHTML = top10.length
    ? top10.map((e, i) => `
        <div class="leaderboard-row ${rankClass(i)} ${currentUser && e.uid === currentUser.uid ? "is-me" : ""}">
          <span><span class="leaderboard-rank">${i + 1}</span>${escapeHtml(e.nickname)}${trophy(i)}</span>
          <span>${e.value}</span>
        </div>`).join("")
    : `<p class="text-muted small">아직 기록이 없습니다.</p>`;

  const myRankEl = document.getElementById("my-rank");
  if (!currentUser) { myRankEl.textContent = ""; return; }
  const myIndex = entries.findIndex(e => e.uid === currentUser.uid);
  myRankEl.textContent = myIndex === -1
    ? "아직 기록이 없습니다"
    : `내 순위: ${myIndex + 1}위 (최고 ${entries[myIndex].value}점)`;
}

document.getElementById("lb-tab-all").addEventListener("click", () => setTab("all"));
document.getElementById("lb-tab-week").addEventListener("click", () => setTab("week"));

function setTab(tab) {
  lbTab = tab;
  document.getElementById("lb-tab-all").classList.toggle("active", tab === "all");
  document.getElementById("lb-tab-week").classList.toggle("active", tab === "week");
  loadLeaderboard();
}
