import { db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import { getTier, randomDropTier, mergeResult, weekKey } from "./suika-logic.js";
import { showVictory } from "./victory.js";
import {
  doc, getDoc, setDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const { Engine, Bodies, Composite, Events } = Matter;

const W = 360, H = 540;
const WALL = 40;          // 벽 두께 (캔버스 밖에 배치)
const DROP_Y = 50;        // 공을 떨어뜨리는 높이
const DANGER_Y = 90;      // 이 선 위에 공이 머물면 게임오버
const GRACE_MS = 2000;    // 갓 생성된 공의 게임오버 판정 유예
const DROP_COOLDOWN = 600;

const canvas = document.getElementById("suika-canvas");
const ctx = canvas.getContext("2d");

const imageCache = new Map();
function getImage(src) {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = `/assets/honor/${src}`;
    imageCache.set(src, img);
  }
  return img;
}

let engine = null;
let score = 0;
let gameOver = false;
let currentTier = 1;
let nextTier = 1;
let canDrop = false;
let aimX = W / 2;
let currentUser = null;
let currentUserData = null;
let lbTab = "all";
let dropTimer = null;
let lastTime = 0;
let topScore = 0; // 전체 리더보드 1위 점수 (loadLeaderboard에서 갱신)

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

requireApproved((user, userData) => {
  currentUser = user;
  currentUserData = userData;
  startNewGame();
  loadLeaderboard();
  requestAnimationFrame(loop);
});

function startNewGame() {
  clearTimeout(dropTimer);
  engine = Engine.create();
  Composite.add(engine.world, [
    Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, { isStatic: true }),
    Bodies.rectangle(-WALL / 2, H / 2, WALL, H * 2, { isStatic: true }),
    Bodies.rectangle(W + WALL / 2, H / 2, WALL, H * 2, { isStatic: true })
  ]);
  Events.on(engine, "collisionStart", onCollision);
  score = 0;
  gameOver = false;
  currentTier = randomDropTier();
  nextTier = randomDropTier();
  canDrop = true;
  document.getElementById("suika-over").style.display = "none";
  updateHud();
}

function makeBall(tier, x, y) {
  const t = getTier(tier);
  const body = Bodies.circle(x, y, t.radius, { restitution: 0.2, friction: 0.4 });
  body.plugin.tier = tier;
  body.plugin.bornAt = performance.now();
  return body;
}

function onCollision(e) {
  if (gameOver) return;
  for (const pair of e.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    if (!a.plugin.tier || a.plugin.tier !== b.plugin.tier) continue;
    if (a.plugin.merged || b.plugin.merged) continue;
    a.plugin.merged = b.plugin.merged = true;
    const res = mergeResult(a.plugin.tier);
    const mx = (a.position.x + b.position.x) / 2;
    const my = (a.position.y + b.position.y) / 2;
    Composite.remove(engine.world, a);
    Composite.remove(engine.world, b);
    if (res.next) Composite.add(engine.world, makeBall(res.next, mx, my));
    score += res.score;
    updateHud();
  }
}

function balls() {
  return Composite.allBodies(engine.world).filter(b => b.plugin.tier);
}

function checkGameOver() {
  const now = performance.now();
  for (const b of balls()) {
    if (now - b.plugin.bornAt < GRACE_MS) continue;
    if (b.position.y - b.circleRadius < DANGER_Y) return true;
  }
  return false;
}

function endGame() {
  gameOver = true;
  canDrop = false;
  document.getElementById("suika-over").style.display = "block";
  if (score > topScore && score > 0) showVictory();
  submitScore(currentUser.uid, currentUserData.nickname, score)
    .then(loadLeaderboard)
    .catch((err) => {
      console.error(err);
      document.getElementById("leaderboard-list").textContent = "점수 저장에 실패했습니다.";
    });
}

function loop(time) {
  const dt = lastTime ? Math.min(time - lastTime, 33) : 1000 / 60;
  lastTime = time;
  Engine.update(engine, dt);
  if (!gameOver && checkGameOver()) endGame();
  draw();
  requestAnimationFrame(loop);
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(220, 60, 60, 0.5)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, DANGER_Y);
  ctx.lineTo(W, DANGER_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (canDrop && !gameOver) {
    drawBall(getTier(currentTier), clampAimX(aimX, currentTier), DROP_Y, 0.5);
  }
  for (const b of balls()) {
    drawBall(getTier(b.plugin.tier), b.position.x, b.position.y, 1);
  }
}

function drawBall(t, x, y, alpha) {
  ctx.globalAlpha = alpha;
  const img = getImage(t.image);
  if (img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, t.radius, 0, Math.PI * 2);
    ctx.clip();
    const size = t.radius * 2;
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(x, y, t.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function clampAimX(x, tier) {
  const r = getTier(tier).radius;
  return Math.min(W - r, Math.max(r, x));
}

function canvasX(e) {
  const rect = canvas.getBoundingClientRect();
  return (e.clientX - rect.left) * (W / rect.width);
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  aimX = canvasX(e);
});
canvas.addEventListener("pointermove", (e) => { aimX = canvasX(e); });
canvas.addEventListener("pointerup", (e) => {
  if (!canDrop || gameOver) return;
  aimX = canvasX(e);
  dropBall();
});

function dropBall() {
  canDrop = false;
  Composite.add(engine.world, makeBall(currentTier, clampAimX(aimX, currentTier), DROP_Y));
  dropTimer = setTimeout(() => {
    currentTier = nextTier;
    nextTier = randomDropTier();
    canDrop = true;
    updateHud();
  }, DROP_COOLDOWN);
}

document.getElementById("btn-suika-restart").addEventListener("click", startNewGame);

function updateHud() {
  document.getElementById("suika-score").textContent = String(score);
  document.getElementById("suika-next").textContent = getTier(nextTier).label;
}

async function submitScore(uid, nickname, finalScore) {
  const ref = doc(db, "suika_scores", uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : {};
  const wk = weekKey(new Date());
  await setDoc(ref, {
    nickname,
    best: Math.max(prev.best || 0, finalScore),
    weekBest: prev.weekKey === wk ? Math.max(prev.weekBest || 0, finalScore) : finalScore,
    weekKey: wk,
    updatedAt: serverTimestamp()
  });
}

async function loadLeaderboard() {
  const snap = await getDocs(collection(db, "suika_scores"));
  const all = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  topScore = all.reduce((m, e) => Math.max(m, e.best || 0), 0);
  const wk = weekKey(new Date());
  const entries = (lbTab === "week"
    ? all.filter(e => e.weekKey === wk).map(e => ({ ...e, value: e.weekBest || 0 }))
    : all.map(e => ({ ...e, value: e.best || 0 })))
    .sort((a, b) => b.value - a.value);

  const top10 = entries.slice(0, 10);
  const listEl = document.getElementById("leaderboard-list");
  listEl.innerHTML = top10.length
    ? top10.map((e, i) => `
        <div class="leaderboard-row ${currentUser && e.uid === currentUser.uid ? "is-me" : ""}">
          <span><span class="leaderboard-rank">${i + 1}</span>${escapeHtml(e.nickname)}</span>
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
