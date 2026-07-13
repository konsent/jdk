# 다이스 드랍 (주사위 수박게임) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수박게임 방식의 물리 낙하 퍼즐(주사위 진화 테마)을 회원 전용 페이지로 추가하고, 전체/이번 주 리더보드를 붙인다.

**Architecture:** 순수 로직(단계 테이블·합체 규칙·주차 계산)은 의존성 없는 ES 모듈로 분리해 `node --test`로 검증한다. 물리는 Matter.js(CDN, 전역 `Matter`)로 돌리고 렌더링은 캔버스 2D 커스텀 루프(색 원 + 라벨 텍스트). 점수는 Firestore `suika_scores/{uid}` 문서 하나로 전체 최고점과 주간 최고점을 함께 관리한다(주차 키가 바뀌면 제출 시 주간 점수를 교체 — 크론 불필요).

**Tech Stack:** Jekyll 정적 페이지, Vanilla JS ES 모듈, Matter.js 0.20.0 (jsdelivr CDN), Firebase 10.12.2 (gstatic CDN, 기존 `firebase-init.js`/`auth-guard.js` 재사용), `node --test`.

## Global Constraints

- 회원 전용: 페이지 진입은 기존 `requireApproved` (assets/js/auth-guard.js) 사용. 비로그인 접근 시 /login/ 리다이렉트.
- 새 의존성은 Matter.js CDN `<script>` 한 줄뿐. npm 패키지 추가 금지.
- 이미지/사운드 에셋 금지 — 도형 + 텍스트 렌더링만.
- Firebase import는 기존 코드와 동일하게 `https://www.gstatic.com/firebasejs/10.12.2/...` 버전 고정.
- 모바일 우선: 캔버스에 `touch-action: none`, 포인터 이벤트로 조작.
- 기존 스타일 변수(`--card-bg`, `--input-border`, `--radius` 등, assets/css/pages.css 정의) 재사용.
- 커밋 메시지는 기존 컨벤션(`feat:`, `docs:`) 유지.

---

### Task 1: 순수 로직 모듈 (단계 테이블·합체·주차 키)

**Files:**
- Create: `assets/js/suika-logic.js`
- Test: `assets/js/suika-logic.test.mjs`

**Interfaces:**
- Consumes: 없음 (의존성 제로 순수 모듈)
- Produces:
  - `TIERS`: 9개 원소 배열, 각 원소 `{ tier, label, radius, color, score }` (테스트에서만 사용)
  - Task 3이 import: `getTier(tier: number): {tier, label, radius, color, score}` — 1-기반 조회
  - `randomDropTier(rand?: () => number): number` — 1~5 반환
  - `mergeResult(tier: number): { next: number|null, score: number }`
  - `weekKey(date: Date): string` — ISO 주차 `"2026-W29"` 형식

- [ ] **Step 1: 실패하는 테스트 작성**

`assets/js/suika-logic.test.mjs`:

```js
import assert from "node:assert";
import { test } from "node:test";
import {
  TIERS, getTier, randomDropTier, mergeResult, weekKey
} from "./suika-logic.js";

test("TIERS: 9단계, 반지름 단조 증가", () => {
  assert.strictEqual(TIERS.length, 9);
  for (let i = 1; i < TIERS.length; i++) {
    assert.ok(TIERS[i].radius > TIERS[i - 1].radius);
  }
});

test("getTier: 1-기반 조회", () => {
  assert.strictEqual(getTier(1).label, "d4");
  assert.strictEqual(getTier(6).label, "d20");
  assert.strictEqual(getTier(9).label, "콩");
});

test("mergeResult: 다음 단계와 그 단계의 점수를 반환", () => {
  assert.deepStrictEqual(mergeResult(1), { next: 2, score: 3 });
  assert.deepStrictEqual(mergeResult(2), { next: 3, score: 6 });
  assert.deepStrictEqual(mergeResult(5), { next: 6, score: 21 });
  assert.deepStrictEqual(mergeResult(8), { next: 9, score: 66 });
});

test("mergeResult: 최종 단계(9)끼리는 소멸하고 66점", () => {
  assert.deepStrictEqual(mergeResult(9), { next: null, score: 66 });
});

test("randomDropTier: 항상 1~5 범위", () => {
  assert.strictEqual(randomDropTier(() => 0), 1);
  assert.strictEqual(randomDropTier(() => 0.999999), 5);
  for (let i = 0; i < 100; i++) {
    const t = randomDropTier();
    assert.ok(t >= 1 && t <= 5);
  }
});

test("weekKey: ISO 주차 (연말 경계 포함)", () => {
  assert.strictEqual(weekKey(new Date(2026, 6, 13)), "2026-W29");  // 월요일
  assert.strictEqual(weekKey(new Date(2026, 0, 4)), "2026-W01");   // 일요일, 1주차 끝
  assert.strictEqual(weekKey(new Date(2026, 0, 5)), "2026-W02");   // 월요일
  assert.strictEqual(weekKey(new Date(2025, 11, 29)), "2026-W01"); // 2025-12-29(월)는 2026년 1주차
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test assets/js/suika-logic.test.mjs`
Expected: FAIL — `Cannot find module ... suika-logic.js`

- [ ] **Step 3: 최소 구현 작성**

`assets/js/suika-logic.js`:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test assets/js/suika-logic.test.mjs`
Expected: PASS (6 tests)

기존 테스트 회귀 확인:
Run: `node --test assets/js/game2048.test.mjs`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add assets/js/suika-logic.js assets/js/suika-logic.test.mjs
git commit -m "feat: add pure suika game logic with tests"
```

---

### Task 2: 페이지 마크업 + 스타일 + 네비게이션

**Files:**
- Create: `suika.html`
- Modify: `assets/css/game.css` (끝에 추가)
- Modify: `_config.yml` (navigation의 `- title: 2048` 항목 바로 아래)

**Interfaces:**
- Consumes: 기존 `pages.css`/`game.css`의 클래스 (`page-wrapper`, `page-card`, `game-header`, `game-score-box`, `leaderboard-row`, `board-section-title`)
- Produces (Task 3이 사용하는 DOM id): `suika-canvas`, `suika-score`, `suika-next`, `suika-over`, `btn-suika-restart`, `lb-tab-all`, `lb-tab-week`, `leaderboard-list`, `my-rank`

- [ ] **Step 1: suika.html 작성**

`suika.html` (game.html과 같은 구조):

```html
---
layout: default
title: 다이스 드랍
permalink: /suika/
---
<link rel="stylesheet" href="/assets/css/pages.css">
<link rel="stylesheet" href="/assets/css/game.css">

<div class="page-wrapper">
  <div class="page-card page-card--wide">
    <p class="page-card__title">다이스 드랍</p>
    <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:24px">
      주사위를 떨어뜨려 같은 주사위끼리 합치세요. d4에서 장단콩까지!
    </p>

    <div class="game-header">
      <div id="my-rank" style="font-size:0.85rem;color:var(--text-secondary)"></div>
      <div class="game-score-box">
        <div class="label">SCORE</div>
        <div class="value" id="suika-score">0</div>
      </div>
    </div>

    <div style="text-align:center;font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">
      다음: <span id="suika-next">-</span>
    </div>

    <canvas id="suika-canvas" class="suika-canvas" width="360" height="540"></canvas>

    <div id="suika-over" style="display:none;text-align:center;margin-top:12px">
      게임 종료! <button id="btn-suika-restart" class="btn-write" style="border:none;cursor:pointer">다시 시작</button>
    </div>

    <div class="section-divider" style="margin:32px 0"></div>

    <p class="board-section-title">랭킹보드 TOP 10</p>
    <div class="lb-tabs">
      <button id="lb-tab-all" class="lb-tab active">전체</button>
      <button id="lb-tab-week" class="lb-tab">이번 주</button>
    </div>
    <div id="leaderboard-list">불러오는 중...</div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js"></script>
<script type="module" src="/assets/js/suika.js"></script>
```

- [ ] **Step 2: game.css 끝에 스타일 추가**

`assets/css/game.css` 파일 끝에 추가:

```css
/* =========================================
   다이스 드랍 (수박게임)
   ========================================= */

.suika-canvas {
  display: block;
  width: min(100%, 400px);
  margin: 0 auto;
  background: var(--card-bg);
  border: 2px solid var(--input-border);
  border-radius: var(--radius);
  touch-action: none;
}

.lb-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.lb-tab {
  padding: 4px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--input-border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
}

.lb-tab.active {
  background: var(--input-border);
  color: var(--text-primary);
  font-weight: 700;
}
```

- [ ] **Step 3: _config.yml 네비게이션 추가**

`_config.yml`의 navigation에서 `- title: 2048` 항목 바로 아래에 추가 (들여쓰기 동일하게):

```yaml
    - title: 다이스 드랍
      url: /suika
```

- [ ] **Step 4: Jekyll 빌드 확인**

Run: `bundle exec jekyll build 2>&1 | tail -3`
Expected: `done in X.XXX seconds.` (에러 없음)
확인: `ls _site/suika/index.html` → 파일 존재

- [ ] **Step 5: 커밋**

```bash
git add suika.html assets/css/game.css _config.yml
git commit -m "feat: add dice drop game page markup, styles, and nav"
```

---

### Task 3: 게임 컨트롤러 (물리·조작·렌더·리더보드)

**Files:**
- Create: `assets/js/suika.js`

**Interfaces:**
- Consumes:
  - Task 1: `getTier`, `randomDropTier`, `mergeResult`, `weekKey` (from `./suika-logic.js`)
  - Task 2의 DOM id: `suika-canvas`, `suika-score`, `suika-next`, `suika-over`, `btn-suika-restart`, `lb-tab-all`, `lb-tab-week`, `leaderboard-list`, `my-rank`
  - 전역 `Matter` (suika.html의 CDN script가 로드)
  - 기존 모듈: `db` (from `./firebase-init.js`), `requireApproved` (from `./auth-guard.js`)
- Produces: Firestore `suika_scores/{uid}` 문서 `{ nickname, best, weekBest, weekKey, updatedAt }`

- [ ] **Step 1: suika.js 작성**

`assets/js/suika.js` 전체:

```js
import { db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import { getTier, randomDropTier, mergeResult, weekKey } from "./suika-logic.js";
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

requireApproved((user, userData) => {
  currentUser = user;
  currentUserData = userData;
  startNewGame();
  loadLeaderboard();
  requestAnimationFrame(loop);
});

function startNewGame() {
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
  submitScore(currentUser.uid, currentUserData.nickname, score)
    .then(loadLeaderboard);
}

function loop() {
  Engine.update(engine, 1000 / 60);
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
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.arc(x, y, t.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${Math.max(12, Math.round(t.radius * 0.6))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t.label, x, y);
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

canvas.addEventListener("pointerdown", (e) => { aimX = canvasX(e); });
canvas.addEventListener("pointermove", (e) => { aimX = canvasX(e); });
canvas.addEventListener("pointerup", (e) => {
  if (!canDrop || gameOver) return;
  aimX = canvasX(e);
  dropBall();
});

function dropBall() {
  canDrop = false;
  Composite.add(engine.world, makeBall(currentTier, clampAimX(aimX, currentTier), DROP_Y));
  setTimeout(() => {
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
          <span><span class="leaderboard-rank">${i + 1}</span>${e.nickname}</span>
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
```

- [ ] **Step 2: 문법 검증 + 전체 테스트**

Run: `node --check assets/js/suika.js`
Expected: 출력 없음 (문법 오류 없음)

Run: `node --test assets/js/suika-logic.test.mjs assets/js/game2048.test.mjs`
Expected: 전부 PASS

- [ ] **Step 3: 로컬 수동 확인 (가능한 범위에서)**

Run: `bundle exec jekyll serve --detach 2>&1 | tail -1` 후 `curl -s http://127.0.0.1:4000/suika/ | grep -c "suika-canvas"`
Expected: `1` (페이지가 서빙되고 캔버스 마크업 존재)

확인 후 정리: `pkill -f jekyll`

참고: 실제 게임플레이(터치 조작, 합체, 게임오버, 점수 제출)는 로그인이 필요하므로 사람이 브라우저에서 확인한다 — 마지막 "런칭 전 확인" 섹션 참조.

- [ ] **Step 4: 커밋**

```bash
git add assets/js/suika.js
git commit -m "feat: wire up dice drop game controller with physics and leaderboard"
```

---

## 런칭 전 확인 (사람 작업)

구현 완료 후 사용자가 직접:

1. **Firestore 보안 규칙 추가** — Firebase 콘솔에서 `suika_scores` 컬렉션에 기존 `game_scores`와 동일한 규칙 추가 (규칙 파일이 저장소에 없으므로 콘솔에서 관리). 이거 없으면 점수 제출이 권한 오류로 실패한다.
2. 로그인 후 `/suika/` 접속: 드래그로 조준 → 놓으면 낙하 → 같은 주사위 합체 → 점수 증가 확인.
3. 모바일(카톡 인앱 브라우저 포함)에서 터치 조작 확인.
4. 게임오버 후 리더보드 "전체"/"이번 주" 탭 각각에 점수 반영 확인.
5. 배포 후 단톡방에 링크 공유.
