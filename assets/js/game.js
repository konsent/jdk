import { requireApproved } from "./auth-guard.js";
import { createEmptyGrid, addRandomTile, move, isGameOver } from "./game2048.js";
import { showVictory } from "./victory.js";
import {
  submitScore, renderLeaderboard, fetchTopScore, setupLeaderboardTabs
} from "./leaderboard.js";

const LB = { collectionName: "game_scores", bestField: "bestScore" };

let grid = createEmptyGrid();
let score = 0;
let gameOver = false;
let currentUser = null;
let currentUserData = null;
let lbTab = "all";
let topScore = 0; // 전체 1위 점수 — 신기록 연출 판정용

requireApproved((user, userData) => {
  currentUser = user;
  currentUserData = userData;
  startNewGame();
  loadLeaderboard();
});

async function loadLeaderboard() {
  await renderLeaderboard(LB, lbTab, currentUser?.uid);
  topScore = await fetchTopScore(LB).catch(() => topScore);
}

setupLeaderboardTabs((tab) => {
  lbTab = tab;
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
    submitScore(LB, currentUser.uid, currentUserData.nickname, score)
      .then(loadLeaderboard)
      .catch((err) => {
        console.error("점수 저장 실패", err);
        document.getElementById("leaderboard-list").textContent = "점수 저장에 실패했습니다.";
      });
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

