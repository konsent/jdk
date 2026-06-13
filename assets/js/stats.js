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

function getTop10(members, key) {
  return Object.entries(members)
    .map(([uid, d]) => ({ uid, nickname: d.nickname, value: d[key] || 0 }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function renderPeriodFilter() {
  const years = [...new Set(allEvents
    .map(e => e.eventDate?.toDate().getFullYear())
    .filter(Boolean))].sort();
  const el = document.getElementById("period-filter");
  const buttons = ["all", ...years].map(p => {
    const label = p === "all" ? "전체" : `${p}년`;
    return `<button class="btn btn-sm ${p == currentPeriod ? "btn-dark" : "btn-outline-secondary"} me-1 mb-1" onclick="setPeriod('${p}')">${label}</button>`;
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

  const snap = await getDocs(collection(db, "monthly_stats"));
  const yearDocs = snap.docs
    .filter(d => d.id.startsWith(`${period}-`))
    .map(d => d.data());

  if (!yearDocs.length) {
    document.getElementById("chart-attend").parentElement.innerHTML =
      `<h5>참석 횟수 랭킹 (TOP 10)</h5><p class="text-muted small">${period}년 저장된 스냅샷이 없습니다. 운영자 도구에서 월별 저장을 해주세요.</p>`;
    document.getElementById("chart-post").parentElement.innerHTML =
      `<h5>일정 등록 횟수 랭킹 (TOP 10)</h5><p class="text-muted small">${period}년 저장된 스냅샷이 없습니다.</p>`;
    renderMonthlyChart(parseInt(period));
    return;
  }

  const merged = {};
  yearDocs.forEach(snapshot => {
    Object.entries(snapshot.members || {}).forEach(([uid, d]) => {
      if (!merged[uid]) merged[uid] = { nickname: d.nickname, attendCount: 0, postCount: 0 };
      merged[uid].attendCount += d.attendCount || 0;
      merged[uid].postCount += d.postCount || 0;
    });
  });

  renderBarChart(
    "chart-attend", getTop10(merged, "attendCount"), "#1a1a1a",
    attendChart, c => { attendChart = c; }
  );
  renderBarChart(
    "chart-post", getTop10(merged, "postCount"), "#2e7d32",
    postChart, c => { postChart = c; }
  );
  renderMonthlyChart(parseInt(period));
};

function renderCharts(period) {
  const members = globalStats.members || {};
  renderBarChart(
    "chart-attend", getTop10(members, "attendCount"), "#1a1a1a",
    attendChart, c => { attendChart = c; }
  );
  renderBarChart(
    "chart-post", getTop10(members, "postCount"), "#2e7d32",
    postChart, c => { postChart = c; }
  );
  renderMonthlyChart(null);
}

function renderBarChart(canvasId, data, color, existingChart, setChart) {
  if (existingChart) existingChart.destroy();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (!data.length) {
    const parent = canvas.parentElement;
    canvas.style.display = "none";
    if (!parent.querySelector(".no-data-msg")) {
      const msg = document.createElement("p");
      msg.className = "text-muted small no-data-msg";
      msg.textContent = "데이터가 없습니다.";
      parent.appendChild(msg);
    }
    return;
  }
  canvas.style.display = "block";
  canvas.parentElement.querySelector(".no-data-msg")?.remove();

  const ctx = canvas.getContext("2d");
  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d.nickname),
      datasets: [{
        data: data.map(d => d.value),
        backgroundColor: data.map((_, i) => i === 0 ? "#c62828" : color),
        borderRadius: 3,
        maxBarThickness: 12
      }]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { stepSize: 1, font: { size: 11 } }, beginAtZero: true },
        y: { ticks: { font: { size: 12 } } }
      }
    }
  });
  setChart(chart);
}

function renderMonthlyChart(filterYear) {
  const counts = {};
  allEvents.forEach(e => {
    const d = e.eventDate?.toDate();
    if (!d) return;
    if (filterYear && d.getFullYear() !== filterYear) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const labels = Object.keys(counts).sort();
  const values = labels.map(k => counts[k]);

  if (monthlyChart) monthlyChart.destroy();
  const ctx = document.getElementById("chart-monthly")?.getContext("2d");
  if (!ctx) return;

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
  const attendTop = getTop10(members, "attendCount")[0];
  const postTop = getTop10(members, "postCount")[0];

  const fullCount = {};
  allEvents.forEach(e => {
    const uid = e.authorUid;
    if (!uid) return;
    if (!fullCount[uid]) fullCount[uid] = { full: 0, total: 0, nickname: members[uid]?.nickname || "" };
    fullCount[uid].total++;
    if ((e.attendees?.length || 0) >= e.maxAttendees) fullCount[uid].full++;
  });

  const fullTop = Object.entries(fullCount)
    .map(([uid, d]) => ({ uid, nickname: d.nickname, value: d.full }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)[0];

  const rateTop = Object.entries(fullCount)
    .filter(([_, d]) => d.total >= 1)
    .map(([uid, d]) => ({ uid, nickname: d.nickname, value: d.full / d.total }))
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

    const postsSnap = await getDocs(query(collection(db, "posts"), where("type", "==", "event")));
    const usersSnap = await getDocs(collection(db, "users"));
    const nicknameMap = {};
    usersSnap.forEach(d => { nicknameMap[d.id] = d.data().nickname || ""; });

    const rebuilt = {};
    postsSnap.docs.forEach(d => {
      const post = d.data();
      const author = post.authorUid;
      if (!author) return;
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
    sorted.map(d => `<span class="badge bg-secondary me-1 mb-1" style="cursor:pointer" onclick="setPeriod('${d.id.slice(0, 4)}')">${d.id}</span>`).join("");
}

function showActionMsg(msg) {
  const el = document.getElementById("msg-action");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 3000);
}
