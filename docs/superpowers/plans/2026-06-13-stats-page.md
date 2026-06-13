# 통계 페이지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일정 참석/등록 데이터를 Firestore stats 컬렉션에 실시간 누적하고, 운영자 전용 통계 페이지(/stats/)에서 Chart.js로 시각화한다.

**Architecture:** 참석 신청/취소/게시글 등록 시 `stats/global` 단일 문서를 increment로 업데이트한다. 통계 페이지는 이 문서 1번 읽기로 전체 통계를 표시하고, 월말 운영자가 버튼으로 `monthly_stats/YYYY-MM` 스냅샷을 저장한다. 기존 데이터는 "통계 초기화" 버튼으로 posts 전체 순회해 재구성한다.

**Tech Stack:** Firebase Firestore (increment, setDoc), Chart.js v4 (CDN), Vanilla JS (ES Modules), Jekyll (GitHub Pages)

---

## 파일 구조

### 신규 생성
```
stats.html                  ← 통계 페이지 (isAdmin만 접근)
assets/js/stats.js          ← 통계 페이지 전용 JS
```

### 수정
```
assets/js/write.js          ← 게시글 등록 시 stats/global postCount +1
assets/js/post.js           ← 참석 신청/취소 시 stats/global attendCount ±1
```

### Firestore (콘솔에서 수동)
```
보안 규칙에 stats, monthly_stats 컬렉션 추가
```

---

## Task 1: Firestore 보안 규칙 업데이트 (수동)

**Files:** Firebase 콘솔 보안 규칙

- [ ] **Step 1: Firebase 콘솔 → Firestore → 규칙 탭에서 기존 규칙 맨 아래 `}` 닫기 전에 추가**

```
match /stats/{docId} {
  allow read: if isAdmin();
  allow write: if isAdmin();
}

match /monthly_stats/{docId} {
  allow read: if isAdmin();
  allow write: if isAdmin();
}
```

- [ ] **Step 2: "게시" 클릭 후 완료 확인**

---

## Task 2: write.js 수정 — 게시글 등록 시 stats 업데이트

**Files:**
- Modify: `assets/js/write.js`

- [ ] **Step 1: write.js import에 `doc`, `updateDoc`, `increment`, `setDoc` 추가**

```js
import { db } from "./firebase-init.js";
import { requireApproved } from "./auth-guard.js";
import {
  collection, addDoc, serverTimestamp, Timestamp,
  doc, setDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
```

- [ ] **Step 2: 게시글 등록 성공 후 stats 업데이트 추가**

기존 코드:
```js
  try {
    const ref = await addDoc(collection(db, "posts"), postData);
    location.href = `/post/?id=${ref.id}`;
  } catch (err) {
    showError("등록 중 오류가 발생했습니다.");
  }
```

교체:
```js
  try {
    const ref = await addDoc(collection(db, "posts"), postData);

    if (type === "event") {
      const statsRef = doc(db, "stats", "global");
      await setDoc(statsRef, {
        updatedAt: serverTimestamp(),
        members: {
          [currentUser.uid]: {
            nickname: currentUserData.nickname,
            postCount: increment(1),
            attendCount: increment(0)
          }
        }
      }, { merge: true });
    }

    location.href = `/post/?id=${ref.id}`;
  } catch (err) {
    showError("등록 중 오류가 발생했습니다.");
  }
```

- [ ] **Step 3: 커밋**

```bash
git add assets/js/write.js
git commit -m "feat: update stats/global on event post creation"
```

---

## Task 3: post.js 수정 — 참석 신청/취소 시 stats 업데이트

**Files:**
- Modify: `assets/js/post.js`

- [ ] **Step 1: post.js import에 `increment`, `setDoc` 추가**

기존:
```js
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, query, where, orderBy, getDocs,
  addDoc, deleteDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
```

교체:
```js
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, query, where, orderBy, getDocs,
  addDoc, deleteDoc, serverTimestamp, runTransaction,
  increment, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
```

- [ ] **Step 2: 참석 신청 버튼 클릭 핸들러에 stats 업데이트 추가**

기존:
```js
  document.getElementById("btn-attend").addEventListener("click", async () => {
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "posts", postId);
        const latest = await tx.get(ref);
        const latestAttendees = latest.data().attendees || [];
        if (latestAttendees.length >= postData.maxAttendees) throw new Error("마감");
        if (latestAttendees.includes(currentUser.uid)) throw new Error("이미 신청");
        tx.update(ref, { attendees: arrayUnion(currentUser.uid) });
      });
      location.reload();
    } catch (e) {
      alert(e.message === "마감" ? "정원이 마감됐습니다." : "오류가 발생했습니다.");
    }
  });
```

교체:
```js
  document.getElementById("btn-attend").addEventListener("click", async () => {
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "posts", postId);
        const latest = await tx.get(ref);
        const latestAttendees = latest.data().attendees || [];
        if (latestAttendees.length >= postData.maxAttendees) throw new Error("마감");
        if (latestAttendees.includes(currentUser.uid)) throw new Error("이미 신청");
        tx.update(ref, { attendees: arrayUnion(currentUser.uid) });
      });
      await setDoc(doc(db, "stats", "global"), {
        updatedAt: serverTimestamp(),
        members: {
          [currentUser.uid]: {
            nickname: currentUserData.nickname,
            attendCount: increment(1),
            postCount: increment(0)
          }
        }
      }, { merge: true });
      location.reload();
    } catch (e) {
      alert(e.message === "마감" ? "정원이 마감됐습니다." : "오류가 발생했습니다.");
    }
  });
```

- [ ] **Step 3: 참석 취소 버튼 클릭 핸들러에 stats 업데이트 추가**

기존:
```js
  document.getElementById("btn-cancel").addEventListener("click", async () => {
    await updateDoc(doc(db, "posts", postId), { attendees: arrayRemove(currentUser.uid) });
    location.reload();
  });
```

교체:
```js
  document.getElementById("btn-cancel").addEventListener("click", async () => {
    await updateDoc(doc(db, "posts", postId), { attendees: arrayRemove(currentUser.uid) });
    const statsSnap = await getDoc(doc(db, "stats", "global"));
    const currentCount = statsSnap.data()?.members?.[currentUser.uid]?.attendCount || 0;
    if (currentCount > 0) {
      await setDoc(doc(db, "stats", "global"), {
        updatedAt: serverTimestamp(),
        members: {
          [currentUser.uid]: {
            nickname: currentUserData.nickname,
            attendCount: increment(-1),
            postCount: increment(0)
          }
        }
      }, { merge: true });
    }
    location.reload();
  });
```

- [ ] **Step 4: 커밋**

```bash
git add assets/js/post.js
git commit -m "feat: update stats/global on attend/cancel"
```

---

## Task 4: 통계 페이지 생성 (stats.html + stats.js)

**Files:**
- Create: `stats.html`
- Create: `assets/js/stats.js`

- [ ] **Step 1: stats.html 생성**

```html
---
layout: default
title: 통계
permalink: /stats/
---
<link rel="stylesheet" href="/assets/css/board.css">

<div style="padding: 32px 0 64px; max-width: 860px; margin: 0 auto;">
  <h2 class="mb-1">통계</h2>
  <p class="text-muted small mb-4">장단콩 클럽 활동 통계입니다.</p>

  <!-- 기간 필터 -->
  <div class="mb-4" id="period-filter"></div>

  <!-- 어워드 카드 -->
  <div id="award-cards" class="mb-5"></div>

  <!-- 차트 1: 참석 랭킹 -->
  <div class="mb-5">
    <h5>참석 횟수 랭킹 (TOP 10)</h5>
    <canvas id="chart-attend" height="320"></canvas>
  </div>

  <!-- 차트 2: 일정 등록 랭킹 -->
  <div class="mb-5">
    <h5>일정 등록 횟수 랭킹 (TOP 10)</h5>
    <canvas id="chart-post" height="320"></canvas>
  </div>

  <!-- 차트 3: 월별 일정 수 -->
  <div class="mb-5">
    <h5>월별 일정 수</h5>
    <canvas id="chart-monthly" height="240"></canvas>
  </div>

  <!-- 운영자 전용 -->
  <div id="admin-actions" style="display:none">
    <hr>
    <h5>운영자 도구</h5>
    <button id="btn-save-snapshot" class="btn btn-sm btn-primary me-2">이번 달 통계 저장</button>
    <button id="btn-rebuild" class="btn btn-sm btn-outline-secondary me-2">통계 초기화 (전체 재계산)</button>
    <div id="snapshot-list" class="mt-3"></div>
    <p id="msg-action" class="text-success mt-2" style="display:none"></p>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<script type="module" src="/assets/js/stats.js"></script>
```

- [ ] **Step 2: stats.js 생성**

```js
// assets/js/stats.js
import { db } from "./firebase-init.js";
import { requireAdmin } from "./auth-guard.js";
import {
  doc, getDoc, setDoc, getDocs,
  collection, query, where, orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let adminUser = null;
let adminData = null;
let globalStats = null;
let allEvents = [];
let currentPeriod = "all";
let attendChart = null;
let postChart = null;
let monthlyChart = null;

requireAdmin(async (user, userData) => {
  adminUser = user;
  adminData = userData;

  globalStats = await loadGlobalStats();
  allEvents = await loadAllEvents();

  renderPeriodFilter();
  renderAwards();
  renderCharts("all");
  renderAdminTools();
});

async function loadGlobalStats() {
  const snap = await getDoc(doc(db, "stats", "global"));
  return snap.exists() ? snap.data() : { members: {} };
}

async function loadAllEvents() {
  const snap = await getDocs(query(
    collection(db, "posts"),
    where("type", "==", "event"),
    orderBy("eventDate", "asc")
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function getMembersForPeriod(period) {
  if (period === "all") return globalStats.members || {};
  // 연도별: 해당 연도 monthly_stats 문서들 합산 (snapshots에서)
  // 여기선 전체만 사용 (연도별은 스냅샷 로딩 후 처리)
  return globalStats.members || {};
}

function getTop10(members, key) {
  return Object.entries(members)
    .map(([uid, d]) => ({ uid, nickname: d.nickname, value: d[key] || 0 }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function renderPeriodFilter() {
  const years = [...new Set(allEvents.map(e => e.eventDate?.toDate().getFullYear()))].sort();
  const el = document.getElementById("period-filter");
  const buttons = ["all", ...years].map(p => {
    const label = p === "all" ? "전체" : `${p}년`;
    return `<button class="btn btn-sm ${p === currentPeriod ? "btn-dark" : "btn-outline-secondary"} me-1 mb-1" onclick="setPeriod('${p}')">${label}</button>`;
  });
  el.innerHTML = buttons.join("");
}

window.setPeriod = async (period) => {
  currentPeriod = period;
  renderPeriodFilter();

  if (period === "all") {
    renderCharts("all");
    return;
  }

  // 연도별: monthly_stats에서 해당 연도 문서 합산
  const snap = await getDocs(collection(db, "monthly_stats"));
  const yearDocs = snap.docs
    .filter(d => d.id.startsWith(`${period}-`))
    .map(d => d.data());

  if (!yearDocs.length) {
    document.getElementById("chart-attend").parentElement.innerHTML =
      `<h5>참석 횟수 랭킹 (TOP 10)</h5><p class="text-muted">저장된 스냅샷이 없습니다.</p>`;
    document.getElementById("chart-post").parentElement.innerHTML =
      `<h5>일정 등록 횟수 랭킹 (TOP 10)</h5><p class="text-muted">저장된 스냅샷이 없습니다.</p>`;
    return;
  }

  // 여러 월 합산
  const merged = {};
  yearDocs.forEach(snapshot => {
    Object.entries(snapshot.members || {}).forEach(([uid, d]) => {
      if (!merged[uid]) merged[uid] = { nickname: d.nickname, attendCount: 0, postCount: 0 };
      merged[uid].attendCount += d.attendCount || 0;
      merged[uid].postCount += d.postCount || 0;
    });
  });

  renderBarChart("chart-attend", getTop10(merged, "attendCount"), "#1a1a1a", attendChart, c => attendChart = c);
  renderBarChart("chart-post", getTop10(merged, "postCount"), "#2e7d32", postChart, c => postChart = c);
};

function renderCharts(period) {
  const members = getMembersForPeriod(period);
  renderBarChart("chart-attend", getTop10(members, "attendCount"), "#1a1a1a", attendChart, c => attendChart = c);
  renderBarChart("chart-post", getTop10(members, "postCount"), "#2e7d32", postChart, c => postChart = c);
  renderMonthlyChart();
}

function renderBarChart(canvasId, data, color, existingChart, setChart) {
  if (existingChart) existingChart.destroy();
  const ctx = document.getElementById(canvasId).getContext("2d");
  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d.nickname),
      datasets: [{
        data: data.map(d => d.value),
        backgroundColor: data.map((_, i) => i === 0 ? "#c62828" : color),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { stepSize: 1 }, beginAtZero: true },
        y: { ticks: { font: { size: 13 } } }
      }
    }
  });
  setChart(chart);
}

function renderMonthlyChart() {
  const year = currentPeriod === "all" ? null : parseInt(currentPeriod);
  const counts = {};
  allEvents.forEach(e => {
    const d = e.eventDate?.toDate();
    if (!d) return;
    if (year && d.getFullYear() !== year) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const labels = Object.keys(counts).sort();
  const values = labels.map(k => counts[k]);

  if (monthlyChart) monthlyChart.destroy();
  const ctx = document.getElementById("chart-monthly").getContext("2d");
  monthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: "#0d6efd",
        borderRadius: 4
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}

function renderAwards() {
  const members = globalStats.members || {};

  // 개근왕, 일정 메이커
  const attendTop = getTop10(members, "attendCount")[0];
  const postTop = getTop10(members, "postCount")[0];

  // 만석 달성왕, 참석률왕 (posts 기반)
  const fullCount = {};
  const fullRate = {};
  allEvents.forEach(e => {
    const isFull = (e.attendees?.length || 0) >= e.maxAttendees;
    if (!fullCount[e.authorUid]) fullCount[e.authorUid] = { full: 0, total: 0, nickname: "" };
    fullCount[e.authorUid].total++;
    if (isFull) fullCount[e.authorUid].full++;
  });

  // nickname 채우기
  Object.entries(members).forEach(([uid, d]) => {
    if (fullCount[uid]) fullCount[uid].nickname = d.nickname;
  });

  const fullTop = Object.entries(fullCount)
    .map(([uid, d]) => ({ uid, nickname: d.nickname, value: d.full }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)[0];

  const rateTop = Object.entries(fullCount)
    .filter(([_, d]) => d.total >= 1)
    .map(([uid, d]) => ({ uid, nickname: d.nickname, value: d.total > 0 ? d.full / d.total : 0 }))
    .sort((a, b) => b.value - a.value)[0];

  const cards = [
    { emoji: "🏆", title: "개근왕", name: attendTop?.nickname || "-", value: attendTop ? `${attendTop.value}회 참석` : "" },
    { emoji: "📅", title: "일정 메이커", name: postTop?.nickname || "-", value: postTop ? `${postTop.value}개 등록` : "" },
    { emoji: "⚡", title: "만석 달성왕", name: fullTop?.nickname || "-", value: fullTop ? `${fullTop.value}회 만석` : "" },
    { emoji: "🎯", title: "참석률왕", name: rateTop?.nickname || "-", value: rateTop ? `${Math.round(rateTop.value * 100)}% 달성률` : "" }
  ];

  document.getElementById("award-cards").innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:8px">
      ${cards.map(c => `
        <div style="border:1px solid #e8e8e4;border-radius:8px;padding:16px;background:#fff;text-align:center">
          <div style="font-size:1.8rem">${c.emoji}</div>
          <div style="font-size:0.75rem;color:#888;margin:4px 0">${c.title}</div>
          <div style="font-weight:700;font-size:1rem">${c.name}</div>
          <div style="font-size:0.8rem;color:#555">${c.value}</div>
        </div>`).join("")}
    </div>
    <p class="text-muted small">* 만석 달성왕·참석률왕은 전체 기간 기준</p>
  `;
}

function renderAdminTools() {
  document.getElementById("admin-actions").style.display = "block";
  loadSnapshotList();

  document.getElementById("btn-save-snapshot").addEventListener("click", async () => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await setDoc(doc(db, "monthly_stats", key), {
      savedAt: serverTimestamp(),
      savedBy: adminData.nickname,
      members: globalStats.members || {}
    });
    showActionMsg(`${key} 스냅샷이 저장됐습니다.`);
    loadSnapshotList();
  });

  document.getElementById("btn-rebuild").addEventListener("click", async () => {
    if (!confirm("기존 stats/global을 초기화하고 전체 posts를 재집계합니다. 계속할까요?")) return;

    const snap = await getDocs(query(collection(db, "posts"), where("type", "==", "event")));
    const usersSnap = await getDocs(collection(db, "users"));
    const nicknameMap = {};
    usersSnap.forEach(d => { nicknameMap[d.id] = d.data().nickname || ""; });

    const rebuilt = {};
    snap.docs.forEach(d => {
      const post = d.data();
      const author = post.authorUid;
      if (!rebuilt[author]) rebuilt[author] = { nickname: nicknameMap[author] || "", attendCount: 0, postCount: 0 };
      rebuilt[author].postCount++;
      (post.attendees || []).forEach(uid => {
        if (!rebuilt[uid]) rebuilt[uid] = { nickname: nicknameMap[uid] || "", attendCount: 0, postCount: 0 };
        rebuilt[uid].attendCount++;
      });
    });

    await setDoc(doc(db, "stats", "global"), {
      updatedAt: serverTimestamp(),
      members: rebuilt
    });

    globalStats = { members: rebuilt };
    renderAwards();
    renderCharts(currentPeriod);
    showActionMsg("통계가 재계산됐습니다.");
  });
}

async function loadSnapshotList() {
  const snap = await getDocs(collection(db, "monthly_stats"));
  const el = document.getElementById("snapshot-list");
  if (snap.empty) { el.innerHTML = "<p class='text-muted small'>저장된 스냅샷이 없습니다.</p>"; return; }
  const sorted = snap.docs.sort((a, b) => b.id.localeCompare(a.id));
  el.innerHTML = `<p class="small text-muted mb-1">저장된 월별 스냅샷:</p>` +
    sorted.map(d => `<span class="badge bg-secondary me-1" style="cursor:pointer" onclick="setPeriod('${d.id.slice(0,4)}')">${d.id}</span>`).join("");
}

function showActionMsg(msg) {
  const el = document.getElementById("msg-action");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 3000);
}
```

- [ ] **Step 3: 커밋**

```bash
git add stats.html assets/js/stats.js
git commit -m "feat: add stats page with Chart.js charts and admin tools"
```

---

## Task 5: 네비게이션 및 board.html 링크 추가

**Files:**
- Modify: `board.html` — 하단에 통계 페이지 링크 추가

- [ ] **Step 1: board.html 하단 `</div>` 닫기 전에 통계 링크 추가**

`board.html`에서 `</div>` (가장 바깥 div) 닫기 전에:

```html
  <div style="margin-top:32px;text-align:right">
    <a href="/stats/" id="link-stats" style="display:none;font-size:0.85rem;color:#888">📊 통계 보기</a>
  </div>
```

- [ ] **Step 2: board.js에서 isAdmin이면 통계 링크 표시**

`board.js`의 `requireApproved` 콜백 내부 맨 끝에 추가:

```js
requireApproved(async (user, userData) => {
  await loadNotices();
  const events = await loadEvents();
  renderCalendar(events);
  renderList(events);
  // 운영자에게만 통계 링크 표시
  if (userData.isAdmin) {
    const link = document.getElementById("link-stats");
    if (link) link.style.display = "inline";
  }
});
```

- [ ] **Step 3: 커밋 및 푸시**

```bash
git add board.html assets/js/board.js
git commit -m "feat: show stats link on board for admin"
git push origin master
```

---

## Task 6: 통계 초기화 실행 (수동)

배포 후 기존 posts 데이터를 stats에 반영하기 위해 초기화 버튼을 한 번 실행한다.

- [ ] **Step 1: `https://www.jdkclub.click/stats/` 접속 (운영자 계정)**

- [ ] **Step 2: "통계 초기화 (전체 재계산)" 버튼 클릭 → 확인**

- [ ] **Step 3: Firebase 콘솔 → Firestore → `stats/global` 문서 생성됐는지 확인**

  `members` 필드 안에 각 uid별 `attendCount`, `postCount`가 채워져 있어야 함.

- [ ] **Step 4: 차트와 어워드 카드가 정상적으로 표시되는지 브라우저에서 확인**
