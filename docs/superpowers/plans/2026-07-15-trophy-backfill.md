# 트로피 소급 재계산(백필) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 `stats.html`에서 버튼 하나로 모든 회원의 18개 트로피 조건을 현재 데이터 기준으로 재판정해, 시스템 도입 이전부터 이미 조건을 만족했던 회원들에게 트로피를 소급 수여한다.

**Architecture:** `functions/trophies.js`의 판정 함수들을 ESM으로 재작성한 `assets/js/trophy-conditions.js`를 새로 만들고, `stats.html`/`stats.js`에 백필 버튼과 로직을 추가한다. 6개 컬렉션(`users`, `stats/global`, `parties`, `game_scores`, `suika_scores`, `posts`)을 한 번씩 전체 로드해 메모리에서 회원별로 판정한 뒤, 신규 트로피만 `arrayUnion`으로 기록한다.

**Tech Stack:** vanilla JS (ES modules), Firebase client SDK (Firestore), `node:test`/`node:assert`.

## Global Constraints

- 트로피는 한번 획득하면 회수하지 않는다 — 백필은 오직 `arrayUnion`으로 신규 트로피만 추가한다.
- `posts` 기반 트로피(불참없이 20회/5일연속/주말개근)는 `type == "event"`이고 `closedAt`이 존재하며 `confirmedAttendees`에 해당 uid가 포함된 이벤트만 집계한다 — 기존 `onPostConfirmed` 트리거와 동일 기준.
- 백필 스크립트의 판정 로직(`assets/js/trophy-conditions.js`)은 `functions/trophies.js`와 같은 입력에 같은 출력을 내야 한다 — 별도 계산식 도입 금지.
- 특정 회원의 Firestore 쓰기가 실패해도 나머지 회원 처리는 계속 진행한다.
- 버튼은 일회성으로 쓰고 지우는 게 아니라 `stats.html`에 상시 배치한다.
- 테스트는 프레임워크 없이 Node 내장 `node:test` + `assert` 사용.

---

## File Structure

- **Create** `assets/js/trophy-conditions.js` — `functions/trophies.js`의 18개 판정 함수를 ESM으로 재작성.
- **Create** `assets/js/trophy-conditions.test.mjs` — 위 함수들이 `functions/trophies.js`와 동일한 출력을 내는지 확인하는 회귀 테스트.
- **Modify** `stats.html` — "트로피 소급 재계산" 버튼 추가.
- **Modify** `assets/js/stats.js` — 버튼 클릭 시 6개 컬렉션 로드 → 회원별 판정 → Firestore 쓰기 → 요약 표시 로직 추가.

---

## Task 1: 판정 로직 ESM 포팅 — `trophy-conditions.js`

**Files:**
- Create: `assets/js/trophy-conditions.js`
- Test: `assets/js/trophy-conditions.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: `checkAttendanceTrophies`, `checkScheduleMakerTrophy`, `checkFullHouseTrophy`, `checkWritingMasterTrophy`, `checkHeartthrobTrophy`, `computeKongzTempServer`, `checkKongzTempTrophies`, `checkGame2048Trophy`, `checkSuikaMasterTrophy`, `checkAnnualMemberTrophy`, `checkPartyPlannerTrophy`, `checkNoNoshowTrophy`, `checkWeekendRegularTrophy`, `hasConsecutiveDays`, `checkFiveDayStreakTrophy`, `newlyEarnedTrophyIds` — 모두 `functions/trophies.js`와 동일한 시그니처/반환값.

- [ ] **Step 1: Write the failing tests**

```js
// assets/js/trophy-conditions.test.mjs
import assert from "node:assert";
import { test } from "node:test";
import {
  checkAttendanceTrophies, checkScheduleMakerTrophy, checkFullHouseTrophy,
  checkWritingMasterTrophy, checkHeartthrobTrophy, computeKongzTempServer,
  checkKongzTempTrophies, checkGame2048Trophy, checkSuikaMasterTrophy,
  checkAnnualMemberTrophy, checkPartyPlannerTrophy, checkNoNoshowTrophy,
  checkWeekendRegularTrophy, hasConsecutiveDays, checkFiveDayStreakTrophy,
  newlyEarnedTrophyIds
} from "./trophy-conditions.js";

test("checkAttendanceTrophies: 100회면 전체 5단계 모두 반환", () => {
  assert.deepStrictEqual(
    checkAttendanceTrophies(100),
    ["kongz-regular", "kongz-veteran", "paju-ghost-1", "paju-ghost-2", "paju-ghost-3"]
  );
});

test("checkScheduleMakerTrophy / checkWritingMasterTrophy: 임계값 확인", () => {
  assert.deepStrictEqual(checkScheduleMakerTrophy(9), []);
  assert.deepStrictEqual(checkScheduleMakerTrophy(10), ["schedule-maker"]);
  assert.deepStrictEqual(checkWritingMasterTrophy(29), []);
  assert.deepStrictEqual(checkWritingMasterTrophy(30), ["writing-master"]);
});

test("checkFullHouseTrophy: 임계값 확인", () => {
  assert.deepStrictEqual(checkFullHouseTrophy(4), []);
  assert.deepStrictEqual(checkFullHouseTrophy(5), ["full-house-king"]);
});

test("checkHeartthrobTrophy: ratingCount 10, 평균 4.5 이상이면 heartthrob", () => {
  const stats = { ratingCount: 10, ratingSum: { manner: 45, skill: 45, again: 45 } };
  assert.deepStrictEqual(checkHeartthrobTrophy(stats), ["heartthrob"]);
});

test("computeKongzTempServer / checkKongzTempTrophies: 62.5도면 kongz-hot+so-hot", () => {
  const stats = { ratingCount: 1, ratingSum: { manner: 5, skill: 5, again: 5 } };
  assert.deepStrictEqual(computeKongzTempServer(stats), { temp: 62.5, count: 1 });
  assert.deepStrictEqual(checkKongzTempTrophies(stats), ["kongz-hot", "so-hot"]);
});

test("checkGame2048Trophy / checkSuikaMasterTrophy: 1위 여부", () => {
  assert.deepStrictEqual(checkGame2048Trophy(true), ["game-2048-champion"]);
  assert.deepStrictEqual(checkSuikaMasterTrophy(true), ["suika-master"]);
});

test("checkAnnualMemberTrophy: true만 수여", () => {
  assert.deepStrictEqual(checkAnnualMemberTrophy(true), ["annual-member"]);
  assert.deepStrictEqual(checkAnnualMemberTrophy(false), []);
});

test("checkPartyPlannerTrophy: 3개 이상", () => {
  assert.deepStrictEqual(checkPartyPlannerTrophy(2), []);
  assert.deepStrictEqual(checkPartyPlannerTrophy(3), ["party-planner"]);
});

test("checkNoNoshowTrophy / checkWeekendRegularTrophy: 임계값 확인", () => {
  assert.deepStrictEqual(checkNoNoshowTrophy(19), []);
  assert.deepStrictEqual(checkNoNoshowTrophy(20), ["no-noshow-20"]);
  assert.deepStrictEqual(checkWeekendRegularTrophy(9), []);
  assert.deepStrictEqual(checkWeekendRegularTrophy(10), ["weekend-regular"]);
});

test("hasConsecutiveDays / checkFiveDayStreakTrophy: 연속 5일 판정", () => {
  const dates = [
    new Date("2026-01-01"), new Date("2026-01-02"), new Date("2026-01-03"),
    new Date("2026-01-04"), new Date("2026-01-05")
  ];
  assert.strictEqual(hasConsecutiveDays(dates, 5), true);
  assert.deepStrictEqual(checkFiveDayStreakTrophy(true), ["five-day-streak"]);
  assert.deepStrictEqual(checkFiveDayStreakTrophy(false), []);
});

test("newlyEarnedTrophyIds: 이미 보유한 id 제외", () => {
  assert.deepStrictEqual(
    newlyEarnedTrophyIds(["kongz-regular"], ["kongz-regular", "schedule-maker"]),
    ["schedule-maker"]
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test assets/js/trophy-conditions.test.mjs`
Expected: FAIL with `Could not find './trophy-conditions.js'`

- [ ] **Step 3: Write the implementation**

```js
// assets/js/trophy-conditions.js
export function checkAttendanceTrophies(attendCount) {
  const ids = [];
  if (attendCount >= 10) ids.push("kongz-regular");
  if (attendCount >= 30) ids.push("kongz-veteran");
  if (attendCount >= 50) ids.push("paju-ghost-1");
  if (attendCount >= 75) ids.push("paju-ghost-2");
  if (attendCount >= 100) ids.push("paju-ghost-3");
  return ids;
}

export function checkScheduleMakerTrophy(postCount) {
  return postCount >= 10 ? ["schedule-maker"] : [];
}

export function checkFullHouseTrophy(fullCount) {
  return fullCount >= 5 ? ["full-house-king"] : [];
}

export function checkWritingMasterTrophy(postCount) {
  return postCount >= 30 ? ["writing-master"] : [];
}

export function checkHeartthrobTrophy(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count < 10) return [];
  const sum = memberStats.ratingSum || {};
  const avg = ((sum.manner || 0) + (sum.skill || 0) + (sum.again || 0)) / 3 / count;
  return avg >= 4.5 ? ["heartthrob"] : [];
}

export function computeKongzTempServer(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count === 0) return { temp: 36.5, count: 0 };
  const sum = memberStats.ratingSum || {};
  const weighted = (sum.manner || 0) * 0.25 + (sum.skill || 0) * 0.25 + (sum.again || 0) * 0.5;
  const avg = weighted / count;
  const temp = Math.round((36.5 + (avg - 3) * 13) * 10) / 10;
  return { temp, count };
}

export function checkKongzTempTrophies(memberStats) {
  const { temp } = computeKongzTempServer(memberStats);
  const ids = [];
  if (temp >= 60) ids.push("kongz-hot");
  if (temp >= 62) ids.push("so-hot");
  return ids;
}

export function checkGame2048Trophy(isTopScorer) {
  return isTopScorer ? ["game-2048-champion"] : [];
}

export function checkAnnualMemberTrophy(annualMember) {
  return annualMember === true ? ["annual-member"] : [];
}

export function checkSuikaMasterTrophy(isTopScorer) {
  return isTopScorer ? ["suika-master"] : [];
}

export function checkPartyPlannerTrophy(partyCount) {
  return partyCount >= 3 ? ["party-planner"] : [];
}

export function checkNoNoshowTrophy(confirmedEventCount) {
  return confirmedEventCount >= 20 ? ["no-noshow-20"] : [];
}

export function checkWeekendRegularTrophy(weekendConfirmedCount) {
  return weekendConfirmedCount >= 10 ? ["weekend-regular"] : [];
}

export function hasConsecutiveDays(dateList, n) {
  if (!dateList.length) return false;
  const dayKeys = [...new Set(
    dateList.map((d) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      return dt.getTime();
    })
  )].sort((a, b) => a - b);

  let streak = 1;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (let i = 1; i < dayKeys.length; i++) {
    if (dayKeys[i] - dayKeys[i - 1] === ONE_DAY) {
      streak++;
      if (streak >= n) return true;
    } else {
      streak = 1;
    }
  }
  return streak >= n;
}

export function checkFiveDayStreakTrophy(hasStreak) {
  return hasStreak ? ["five-day-streak"] : [];
}

export function newlyEarnedTrophyIds(existingIds, candidateIds) {
  return candidateIds.filter((id) => !existingIds.includes(id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test assets/js/trophy-conditions.test.mjs`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add assets/js/trophy-conditions.js assets/js/trophy-conditions.test.mjs
git commit -m "feat: port trophy condition functions to ESM for client-side backfill"
```

---

## Task 2: 백필 버튼 UI — `stats.html`

**Files:**
- Modify: `stats.html`

**Interfaces:**
- Consumes: 없음
- Produces: DOM 요소 `#btn-backfill-trophies` (Task 3에서 이벤트 리스너 연결)

- [ ] **Step 1: 버튼 마크업 추가**

`stats.html`의 `#btn-rebuild` 버튼 바로 뒤에 추가:

```html
    <button id="btn-rebuild" class="btn btn-sm btn-outline-secondary me-2">통계 초기화 (전체 재계산)</button>
    <button id="btn-backfill-trophies" class="btn btn-sm btn-outline-secondary me-2">트로피 소급 재계산</button>
```

- [ ] **Step 2: Commit**

```bash
git add stats.html
git commit -m "feat: add trophy backfill button to stats admin tools"
```

---

## Task 3: 백필 실행 로직 — `stats.js`

**Files:**
- Modify: `assets/js/stats.js`

**Interfaces:**
- Consumes: `checkAttendanceTrophies`, `checkScheduleMakerTrophy`, `checkFullHouseTrophy`, `checkWritingMasterTrophy`, `checkHeartthrobTrophy`, `checkKongzTempTrophies`, `checkGame2048Trophy`, `checkSuikaMasterTrophy`, `checkAnnualMemberTrophy`, `checkPartyPlannerTrophy`, `checkNoNoshowTrophy`, `checkWeekendRegularTrophy`, `hasConsecutiveDays`, `checkFiveDayStreakTrophy`, `newlyEarnedTrophyIds` (Task 1)
- Produces: 없음 (최종 소비 지점, 버튼 클릭 이벤트 핸들러)

이 태스크는 브라우저/Firestore 통합 코드라 자동화된 단위 테스트 대상이 아니다(기존 `renderAdminTools`의 `btn-rebuild` 핸들러도 테스트 없음, 동일 관례). 수동 브라우저 확인으로 검증한다.

- [ ] **Step 1: import 추가**

`assets/js/stats.js` 최상단 import 블록을 수정:

```js
import { db } from "./firebase-init.js";
import { requireAdmin } from "./auth-guard.js";
import {
  doc, getDoc, updateDoc, arrayUnion, setDoc, getDocs,
  collection, query, where, orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  checkAttendanceTrophies, checkScheduleMakerTrophy, checkFullHouseTrophy,
  checkWritingMasterTrophy, checkHeartthrobTrophy, checkKongzTempTrophies,
  checkGame2048Trophy, checkSuikaMasterTrophy, checkAnnualMemberTrophy,
  checkPartyPlannerTrophy, checkNoNoshowTrophy, checkWeekendRegularTrophy,
  hasConsecutiveDays, checkFiveDayStreakTrophy, newlyEarnedTrophyIds
} from "./trophy-conditions.js";
```

- [ ] **Step 2: 데이터 수집 + 판정 + 쓰기 함수 추가**

`assets/js/stats.js`의 `renderAdminTools` 함수 앞(또는 파일 하단 아무 곳)에 다음 함수들을 추가:

```js
function isWeekendDate(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function filterConfirmedClosedEvents(posts, uid) {
  return posts.filter(
    (p) => p.type === "event" && !!p.closedAt && (p.confirmedAttendees || []).includes(uid)
  );
}

function isTopScorerByField(allDocs, uid, field) {
  const scores = allDocs.map((d) => ({ uid: d.id, value: d[field] || 0 }));
  const top = Math.max(...scores.map((s) => s.value));
  if (top === 0) return false;
  const mine = scores.find((s) => s.uid === uid);
  return !!mine && mine.value === top;
}

function countFullHouseEvents(posts, authorUid) {
  return posts.filter(
    (p) => p.authorUid === authorUid && (p.attendees?.length || 0) >= p.maxAttendees
  ).length;
}

async function backfillTrophiesForMember(uid, ctx) {
  const memberStats = ctx.statsMembers[uid];
  const postCount = memberStats?.postCount || 0;
  const attendCount = memberStats?.attendCount || 0;

  const fullCount = countFullHouseEvents(ctx.eventPosts, uid);
  const partyCount = ctx.parties.filter((p) => p.ownerUid === uid).length;
  const is2048Top = isTopScorerByField(ctx.gameScores, uid, "bestScore");
  const isSuikaTop = isTopScorerByField(ctx.suikaScores, uid, "best");

  const confirmedEvents = filterConfirmedClosedEvents(ctx.eventPosts, uid);
  const weekendCount = confirmedEvents
    .map((p) => p.eventDate?.toDate?.())
    .filter((d) => d instanceof Date && isWeekendDate(d)).length;
  const eventDates = confirmedEvents
    .map((p) => p.eventDate?.toDate?.())
    .filter((d) => d instanceof Date);
  const hasStreak = hasConsecutiveDays(eventDates, 5);

  const candidates = [
    ...checkAttendanceTrophies(attendCount),
    ...checkScheduleMakerTrophy(postCount),
    ...checkWritingMasterTrophy(postCount),
    ...checkFullHouseTrophy(fullCount),
    ...checkHeartthrobTrophy(memberStats),
    ...checkKongzTempTrophies(memberStats),
    ...checkGame2048Trophy(is2048Top),
    ...checkSuikaMasterTrophy(isSuikaTop),
    ...checkAnnualMemberTrophy(ctx.users[uid]?.annualMember === true),
    ...checkPartyPlannerTrophy(partyCount),
    ...checkNoNoshowTrophy(confirmedEvents.length),
    ...checkWeekendRegularTrophy(weekendCount),
    ...checkFiveDayStreakTrophy(hasStreak)
  ];

  if (!candidates.length) return 0;

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return 0;

  const existing = userSnap.data().trophies || [];
  const existingIds = existing.map((t) => t.id);
  const toAward = newlyEarnedTrophyIds(existingIds, candidates);
  if (!toAward.length) return 0;

  const newEntries = toAward.map((id) => ({ id, earnedAt: new Date(), seen: false }));
  await updateDoc(userRef, { trophies: arrayUnion(...newEntries) });
  return toAward.length;
}

async function runTrophyBackfill() {
  const usersSnap = await getDocs(collection(db, "users"));
  const users = {};
  usersSnap.forEach((d) => { users[d.id] = d.data(); });

  const statsSnap = await getDoc(doc(db, "stats", "global"));
  const statsMembers = statsSnap.data()?.members || {};

  const partiesSnap = await getDocs(collection(db, "parties"));
  const parties = partiesSnap.docs.map((d) => d.data());

  const gameScoresSnap = await getDocs(collection(db, "game_scores"));
  const gameScores = gameScoresSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const suikaScoresSnap = await getDocs(collection(db, "suika_scores"));
  const suikaScores = suikaScoresSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const eventPostsSnap = await getDocs(query(collection(db, "posts"), where("type", "==", "event")));
  const eventPosts = eventPostsSnap.docs.map((d) => d.data());

  const ctx = { users, statsMembers, parties, gameScores, suikaScores, eventPosts };

  let processedCount = 0;
  let awardedCount = 0;
  let failedCount = 0;

  for (const uid of Object.keys(users)) {
    try {
      awardedCount += await backfillTrophiesForMember(uid, ctx);
      processedCount++;
    } catch (e) {
      console.error(`트로피 백필 실패 (uid: ${uid})`, e);
      failedCount++;
    }
  }

  return { processedCount, awardedCount, failedCount };
}
```

- [ ] **Step 3: 버튼 이벤트 리스너 연결**

`renderAdminTools` 함수 내부, `btn-rebuild` 리스너 등록 블록 뒤에 추가:

```js
  document.getElementById("btn-backfill-trophies").addEventListener("click", async () => {
    if (!confirm("전체 회원의 트로피를 현재 데이터 기준으로 재계산합니다. 계속할까요?")) return;

    document.getElementById("btn-backfill-trophies").disabled = true;
    const { processedCount, awardedCount, failedCount } = await runTrophyBackfill();
    document.getElementById("btn-backfill-trophies").disabled = false;

    const failedText = failedCount > 0 ? `, ${failedCount}명 실패` : "";
    showActionMsg(`${processedCount}명 처리, 총 ${awardedCount}개 트로피 신규 수여${failedText}.`);
  });
```

- [ ] **Step 4: 수동 브라우저 확인**

Jekyll 개발 서버를 띄우고(`bundle exec jekyll serve`), 관리자 계정으로 `/stats/` 접속. "트로피 소급 재계산" 버튼 클릭 → 확인 대화상자 → 완료 후 "N명 처리, 총 M개 트로피 신규 수여" 메시지가 뜨는지 확인. Firestore 콘솔에서 실제로 조건을 만족하는 회원(예: `annualMember: true`인 회원)의 `users/{uid}.trophies`에 `annual-member`가 추가됐는지 확인.

- [ ] **Step 5: Commit**

```bash
git add assets/js/stats.js
git commit -m "feat: implement trophy backfill logic in stats admin tools"
```

---

## Task 4: 통합 확인

**Files:** 없음 (검증 전용 태스크)

**Interfaces:** 없음

- [ ] **Step 1: 트로피 조건 함수 테스트 실행**

Run: `node --test assets/js/trophy-conditions.test.mjs`
Expected: PASS (11개)

- [ ] **Step 2: 기존 전체 테스트 회귀 확인**

Run: `cd functions && node --test`
Run: `node --test assets/js/*.test.mjs` (repo root에서)
Expected: 기존 테스트 전부 PASS (신규 파일 포함해도 다른 파일에 영향 없어야 함)

- [ ] **Step 3: `trophy-conditions.js`와 `functions/trophies.js`의 로직이 일치하는지 대표 케이스로 교차 확인**

```bash
node -e "
const server = require('./functions/trophies.js');
console.log('server attendCount=100:', JSON.stringify(server.checkAttendanceTrophies(100)));
"
node -e "
import('./assets/js/trophy-conditions.js').then(m => {
  console.log('client attendCount=100:', JSON.stringify(m.checkAttendanceTrophies(100)));
});
"
```

Expected: 두 출력이 동일 (`["kongz-regular","kongz-veteran","paju-ghost-1","paju-ghost-2","paju-ghost-3"]`).

- [ ] **Step 4: Commit (변경사항 있을 경우에만)**

이 태스크는 검증 전용이라 코드 변경이 없다면 커밋하지 않는다.

---

## Out of Scope (spec과 동일)

- 이미 받은 트로피를 회수하는 기능
- 백필 실행 이력을 별도로 저장/조회하는 기능
- 회원별 상세 수여 내역 UI
