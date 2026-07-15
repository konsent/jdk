# 트로피 시스템 확장 (13종 추가) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 5종 트로피(콩즈 죽돌이/개근왕, 일정 메이커, 만석 달성왕, 2048 간판왕)에 13종을 추가해 총 18종으로 확장한다. 신규 트로피 판정을 위해 `posts`, `parties`, `users`, `suika_scores` 문서에 대한 Cloud Function 트리거를 신규로 추가하고, 기존 `stats/global` 트리거 로직을 확장한다.

**Architecture:** 조건 판정 로직은 계속 `functions/trophies.js`의 순수 함수로 관리하고 `node --test`로 단위 테스트한다. `functions/index.js`의 기존 `awardTrophies` 헬퍼를 그대로 재사용하며, 신규 트리거들도 기존 `onStatsUpdated`/`onGameScoreUpdated`와 동일한 얇은 오케스트레이션 패턴을 따른다. 클라이언트 `assets/js/trophies-meta.js`에 13개 메타를 추가한다.

**Tech Stack:** Firebase Cloud Functions v2 (`onDocumentWritten`), Firestore, vanilla JS (ES modules), `node:test`/`node:assert`.

## Global Constraints

- 트로피 정의는 `functions/trophies.js`의 코드 상수로 관리한다 (Firestore 설정 문서 없음).
- 트로피 이미지 경로: `/assets/trophies/{id}.png` (실제 이미지 파일은 범위 밖).
- `functions/trophies.js`(서버)와 `assets/js/trophies-meta.js`(클라이언트)의 트로피 메타(`id`/`name`/`description`/`image`)는 항상 내용이 일치해야 한다 (별도 배포 단위라 코드 공유 불가, 값 동기화 필수).
- 트로피는 한번 획득하면 회수하지 않는다 (`newlyEarnedTrophyIds`는 이미 가진 트로피를 제거하지 않음 — 파티 삭제로 3개 미만이 되어도 `party-planner`는 유지).
- 테스트는 프레임워크 없이 Node 내장 `node:test` + `assert` 사용 (기존 `functions/index.test.js`, `assets/js/trophies-meta.test.mjs`와 동일 패턴).
- `posts` 트리거는 `confirmedAttendees`가 실제로 변경됐을 때만 처리한다 (다른 필드 변경으로 인한 불필요한 재계산 방지).
- `users` 트리거는 `annualMember`가 `true`가 아니었다가 `true`로 바뀐 시점에만 처리한다 (매 `users` 쓰기마다 전체 로직을 돌리지 않도록).
- **코드 작성은 `trophy-system` 브랜치에서 계속 진행한다** (이미 해당 브랜치에 있음, 별도 브랜치 생성 불필요).

---

## File Structure

- **Modify** `functions/trophies.js` — 트로피 메타 13개 추가, 조건 판정 순수 함수 9개 추가/확장.
- **Modify** `functions/trophies.test.js` — 위 함수들의 단위 테스트 추가.
- **Modify** `functions/index.js` — `onStatsUpdated` 로직 확장(파주귀신 3종/글쓰기장인/인기만점/콩즈온도왕/쏘핫), 신규 트리거 4개 추가(`onPostConfirmed`, `onSuikaScoreUpdated`, `onPartyUpdated`, `onUserUpdated`).
- **Modify** `functions/index.test.js` — 신규 트리거의 오케스트레이션 헬퍼 함수 테스트 추가.
- **Modify** `assets/js/trophies-meta.js` — 클라이언트 메타 13개 추가.
- **Modify** `assets/js/trophies-meta.test.mjs` — id 목록 동기화 테스트 갱신(18개로).

---

## Task 1: 파주 귀신 3종 + 글쓰기 장인 — 기존 `checkAttendanceTrophies`/신규 함수 확장

**Files:**
- Modify: `functions/trophies.js`
- Test: `functions/trophies.test.js`

**Interfaces:**
- Consumes: 없음 (기존 `TROPHIES` 배열, 기존 `checkAttendanceTrophies` 함수를 이 태스크에서 직접 수정)
- Produces:
  - `checkAttendanceTrophies(attendCount)`: 반환값이 `["kongz-regular", "kongz-veteran", "paju-ghost-1", "paju-ghost-2", "paju-ghost-3"]` 중 해당하는 것들로 확장됨 (10/30/50/75/100 임계값)
  - `checkWritingMasterTrophy(postCount)`: `string[]` — `postCount >= 30`이면 `["writing-master"]`, 아니면 `[]`

- [ ] **Step 1: Write the failing tests**

`functions/trophies.test.js`에 추가:

```js
test("checkAttendanceTrophies: 49회면 kongz-regular/veteran만, paju-ghost 없음", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(49), ["kongz-regular", "kongz-veteran"]);
});

test("checkAttendanceTrophies: 50회면 paju-ghost-1까지", () => {
  assert.deepStrictEqual(checkAttendanceTrophies(50), ["kongz-regular", "kongz-veteran", "paju-ghost-1"]);
});

test("checkAttendanceTrophies: 75회면 paju-ghost-2까지", () => {
  assert.deepStrictEqual(
    checkAttendanceTrophies(75),
    ["kongz-regular", "kongz-veteran", "paju-ghost-1", "paju-ghost-2"]
  );
});

test("checkAttendanceTrophies: 100회면 paju-ghost-3까지 전부", () => {
  assert.deepStrictEqual(
    checkAttendanceTrophies(100),
    ["kongz-regular", "kongz-veteran", "paju-ghost-1", "paju-ghost-2", "paju-ghost-3"]
  );
});

test("checkWritingMasterTrophy: 29개면 빈 배열, 30개면 writing-master", () => {
  assert.deepStrictEqual(checkWritingMasterTrophy(29), []);
  assert.deepStrictEqual(checkWritingMasterTrophy(30), ["writing-master"]);
});
```

파일 상단 require에 `checkWritingMasterTrophy` 추가:

```js
const {
  TROPHIES,
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  checkWritingMasterTrophy,
  newlyEarnedTrophyIds
} = require("./trophies.js");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test trophies.test.js`
Expected: FAIL — `checkAttendanceTrophies(50)` returns only `["kongz-regular", "kongz-veteran"]` (missing paju-ghost-1), and `checkWritingMasterTrophy is not a function`

- [ ] **Step 3: Write the implementation**

`functions/trophies.js`의 `TROPHIES` 배열에 4개 항목 추가 (기존 5개 뒤에 이어서):

```js
  {
    id: "paju-ghost-1",
    name: "파주 귀신 I",
    description: "누적 출석 50회 달성",
    image: "/assets/trophies/paju-ghost-1.png"
  },
  {
    id: "paju-ghost-2",
    name: "파주 귀신 II",
    description: "누적 출석 75회 달성",
    image: "/assets/trophies/paju-ghost-2.png"
  },
  {
    id: "paju-ghost-3",
    name: "파주 귀신 III",
    description: "누적 출석 100회 달성",
    image: "/assets/trophies/paju-ghost-3.png"
  },
  {
    id: "writing-master",
    name: "글쓰기 장인",
    description: "누적 게시글 30개 등록",
    image: "/assets/trophies/writing-master.png"
  }
```

`checkAttendanceTrophies` 함수를 다음으로 교체:

```js
function checkAttendanceTrophies(attendCount) {
  const ids = [];
  if (attendCount >= 10) ids.push("kongz-regular");
  if (attendCount >= 30) ids.push("kongz-veteran");
  if (attendCount >= 50) ids.push("paju-ghost-1");
  if (attendCount >= 75) ids.push("paju-ghost-2");
  if (attendCount >= 100) ids.push("paju-ghost-3");
  return ids;
}
```

새 함수 추가 (`checkFullHouseTrophy` 함수 뒤에):

```js
function checkWritingMasterTrophy(postCount) {
  return postCount >= 30 ? ["writing-master"] : [];
}
```

`module.exports`에 `checkWritingMasterTrophy` 추가:

```js
module.exports = {
  TROPHIES,
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  checkWritingMasterTrophy,
  newlyEarnedTrophyIds
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test trophies.test.js`
Expected: PASS (기존 9개 + 신규 6개 = 15개)

- [ ] **Step 5: Commit**

```bash
git add functions/trophies.js functions/trophies.test.js
git commit -m "feat: add paju-ghost tiers and writing-master trophy definitions"
```

---

## Task 2: 인기 만점 + 콩즈 온도왕/쏘핫 — 평점 기반 트로피

**Files:**
- Modify: `functions/trophies.js`
- Test: `functions/trophies.test.js`

**Interfaces:**
- Consumes: 없음 (독립적인 신규 함수)
- Produces:
  - `checkHeartthrobTrophy(memberStats)`: `string[]` — `memberStats.ratingCount >= 10`이고 `(manner+skill+again)/3/ratingCount >= 4.5`면 `["heartthrob"]`, 아니면 `[]`
  - `computeKongzTempServer(memberStats)`: `{ temp: number, count: number }` — `rating-logic.js`의 `computeKongzTemp`를 CommonJS로 이식한 것과 동일한 계산
  - `checkKongzTempTrophies(memberStats)`: `string[]` — `computeKongzTempServer` 결과의 `temp`가 60 이상이면 `kongz-hot`, 62 이상이면 `so-hot`도 추가 (둘 다 만족하면 둘 다 반환)

- [ ] **Step 1: Write the failing tests**

`functions/trophies.test.js`에 추가:

```js
test("checkHeartthrobTrophy: ratingCount 9면 평균 무관하게 빈 배열", () => {
  const stats = { ratingCount: 9, ratingSum: { manner: 45, skill: 45, again: 45 } };
  assert.deepStrictEqual(checkHeartthrobTrophy(stats), []);
});

test("checkHeartthrobTrophy: ratingCount 10, 평균 4.5 미만이면 빈 배열", () => {
  const stats = { ratingCount: 10, ratingSum: { manner: 40, skill: 40, again: 40 } };
  assert.deepStrictEqual(checkHeartthrobTrophy(stats), []);
});

test("checkHeartthrobTrophy: ratingCount 10, 평균 4.5 이상이면 heartthrob", () => {
  const stats = { ratingCount: 10, ratingSum: { manner: 45, skill: 45, again: 45 } };
  assert.deepStrictEqual(checkHeartthrobTrophy(stats), ["heartthrob"]);
});

test("checkHeartthrobTrophy: memberStats undefined면 빈 배열", () => {
  assert.deepStrictEqual(checkHeartthrobTrophy(undefined), []);
});

test("computeKongzTempServer: ratingCount 0이면 36.5도 기본값", () => {
  assert.deepStrictEqual(computeKongzTempServer(undefined), { temp: 36.5, count: 0 });
});

test("computeKongzTempServer: 매너/실력/재만남 모두 5점 만점이면 62.5도", () => {
  const stats = { ratingCount: 1, ratingSum: { manner: 5, skill: 5, again: 5 } };
  assert.deepStrictEqual(computeKongzTempServer(stats), { temp: 62.5, count: 1 });
});

test("checkKongzTempTrophies: 60도 미만이면 빈 배열", () => {
  const stats = { ratingCount: 1, ratingSum: { manner: 3, skill: 3, again: 3 } };
  assert.deepStrictEqual(checkKongzTempTrophies(stats), []);
});

test("checkKongzTempTrophies: 60도 이상 62도 미만이면 kongz-hot만", () => {
  const stats = { ratingCount: 10, ratingSum: { manner: 50, skill: 50, again: 47 } };
  assert.deepStrictEqual(checkKongzTempTrophies(stats), ["kongz-hot"]);
});

test("checkKongzTempTrophies: 62도 이상이면 kongz-hot과 so-hot 모두", () => {
  const stats = { ratingCount: 1, ratingSum: { manner: 5, skill: 5, again: 5 } };
  assert.deepStrictEqual(checkKongzTempTrophies(stats), ["kongz-hot", "so-hot"]);
});
```

파일 상단 require에 `checkHeartthrobTrophy`, `computeKongzTempServer`, `checkKongzTempTrophies` 추가 (Task 1의 require 블록에 이어서).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test trophies.test.js`
Expected: FAIL — `checkHeartthrobTrophy is not a function` 등

- [ ] **Step 3: Write the implementation**

`functions/trophies.js`의 `TROPHIES` 배열에 3개 항목 추가:

```js
  {
    id: "heartthrob",
    name: "인기 만점",
    description: "평균 평점 4.5 이상 (10회 이상 평가받음)",
    image: "/assets/trophies/heartthrob.png"
  },
  {
    id: "kongz-hot",
    name: "콩즈 온도왕",
    description: "콩즈 온도 60도 이상 달성",
    image: "/assets/trophies/kongz-hot.png"
  },
  {
    id: "so-hot",
    name: "쏘핫",
    description: "콩즈 온도 62도 이상 달성",
    image: "/assets/trophies/so-hot.png"
  }
```

새 함수 3개 추가 (`checkWritingMasterTrophy` 뒤):

```js
function checkHeartthrobTrophy(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count < 10) return [];
  const sum = memberStats.ratingSum || {};
  const avg = ((sum.manner || 0) + (sum.skill || 0) + (sum.again || 0)) / 3 / count;
  return avg >= 4.5 ? ["heartthrob"] : [];
}

function computeKongzTempServer(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count === 0) return { temp: 36.5, count: 0 };
  const sum = memberStats.ratingSum || {};
  const weighted = (sum.manner || 0) * 0.25 + (sum.skill || 0) * 0.25 + (sum.again || 0) * 0.5;
  const avg = weighted / count;
  const temp = Math.round((36.5 + (avg - 3) * 13) * 10) / 10;
  return { temp, count };
}

function checkKongzTempTrophies(memberStats) {
  const { temp } = computeKongzTempServer(memberStats);
  const ids = [];
  if (temp >= 60) ids.push("kongz-hot");
  if (temp >= 62) ids.push("so-hot");
  return ids;
}
```

`module.exports`에 세 함수 추가.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test trophies.test.js`
Expected: PASS (기존 15개 + 신규 8개 = 23개)

- [ ] **Step 5: Commit**

```bash
git add functions/trophies.js functions/trophies.test.js
git commit -m "feat: add heartthrob and kongz-temperature trophy definitions"
```

---

## Task 3: 연회원/콩드랍마스터/파티플래너/불참없음/5일연속/주말개근 — 나머지 조건 함수

**Files:**
- Modify: `functions/trophies.js`
- Test: `functions/trophies.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `checkAnnualMemberTrophy(annualMember)`: `string[]` — `true`면 `["annual-member"]`, 아니면 `[]`
  - `checkSuikaMasterTrophy(isTopScorer)`: `string[]` — `true`면 `["suika-master"]`, 아니면 `[]`
  - `checkPartyPlannerTrophy(partyCount)`: `string[]` — `partyCount >= 3`이면 `["party-planner"]`, 아니면 `[]`
  - `checkNoNoshowTrophy(confirmedEventCount)`: `string[]` — `>= 20`이면 `["no-noshow-20"]`, 아니면 `[]`
  - `checkWeekendRegularTrophy(weekendConfirmedCount)`: `string[]` — `>= 10`이면 `["weekend-regular"]`, 아니면 `[]`
  - `hasConsecutiveDays(dateList, n)`: `boolean` — `Date[]` 배열에서 연-월-일 단위로 중복 제거·정렬 후 하루 간격으로 이어지는 구간이 `n`일 이상이면 `true`
  - `checkFiveDayStreakTrophy(hasStreak)`: `string[]` — `true`면 `["five-day-streak"]`, 아니면 `[]`

- [ ] **Step 1: Write the failing tests**

`functions/trophies.test.js`에 추가:

```js
test("checkAnnualMemberTrophy: true면 annual-member, false/undefined면 빈 배열", () => {
  assert.deepStrictEqual(checkAnnualMemberTrophy(true), ["annual-member"]);
  assert.deepStrictEqual(checkAnnualMemberTrophy(false), []);
  assert.deepStrictEqual(checkAnnualMemberTrophy(undefined), []);
});

test("checkSuikaMasterTrophy: 1위가 아니면 빈 배열, 1위면 suika-master", () => {
  assert.deepStrictEqual(checkSuikaMasterTrophy(false), []);
  assert.deepStrictEqual(checkSuikaMasterTrophy(true), ["suika-master"]);
});

test("checkPartyPlannerTrophy: 2개면 빈 배열, 3개면 party-planner", () => {
  assert.deepStrictEqual(checkPartyPlannerTrophy(2), []);
  assert.deepStrictEqual(checkPartyPlannerTrophy(3), ["party-planner"]);
});

test("checkNoNoshowTrophy: 19회면 빈 배열, 20회면 no-noshow-20", () => {
  assert.deepStrictEqual(checkNoNoshowTrophy(19), []);
  assert.deepStrictEqual(checkNoNoshowTrophy(20), ["no-noshow-20"]);
});

test("checkWeekendRegularTrophy: 9회면 빈 배열, 10회면 weekend-regular", () => {
  assert.deepStrictEqual(checkWeekendRegularTrophy(9), []);
  assert.deepStrictEqual(checkWeekendRegularTrophy(10), ["weekend-regular"]);
});

test("hasConsecutiveDays: 연속 5일이 있으면 true", () => {
  const dates = [
    new Date("2026-01-01"), new Date("2026-01-02"), new Date("2026-01-03"),
    new Date("2026-01-04"), new Date("2026-01-05")
  ];
  assert.strictEqual(hasConsecutiveDays(dates, 5), true);
});

test("hasConsecutiveDays: 연속 4일뿐이면 false", () => {
  const dates = [
    new Date("2026-01-01"), new Date("2026-01-02"), new Date("2026-01-03"), new Date("2026-01-04")
  ];
  assert.strictEqual(hasConsecutiveDays(dates, 5), false);
});

test("hasConsecutiveDays: 중간에 하루라도 빠지면 false", () => {
  const dates = [
    new Date("2026-01-01"), new Date("2026-01-02"), new Date("2026-01-04"),
    new Date("2026-01-05"), new Date("2026-01-06")
  ];
  assert.strictEqual(hasConsecutiveDays(dates, 5), false);
});

test("hasConsecutiveDays: 같은 날짜가 중복돼도 정상 판정", () => {
  const dates = [
    new Date("2026-01-01"), new Date("2026-01-01"), new Date("2026-01-02"),
    new Date("2026-01-03"), new Date("2026-01-04"), new Date("2026-01-05")
  ];
  assert.strictEqual(hasConsecutiveDays(dates, 5), true);
});

test("hasConsecutiveDays: 빈 배열이면 false", () => {
  assert.strictEqual(hasConsecutiveDays([], 5), false);
});

test("checkFiveDayStreakTrophy: true면 five-day-streak", () => {
  assert.deepStrictEqual(checkFiveDayStreakTrophy(true), ["five-day-streak"]);
  assert.deepStrictEqual(checkFiveDayStreakTrophy(false), []);
});
```

파일 상단 require에 이 6개 함수 이름 추가.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test trophies.test.js`
Expected: FAIL — 모든 신규 함수가 `is not a function`

- [ ] **Step 3: Write the implementation**

`functions/trophies.js`의 `TROPHIES` 배열에 6개 항목 추가:

```js
  {
    id: "annual-member",
    name: "연회원 가입",
    description: "연회원으로 가입",
    image: "/assets/trophies/annual-member.png"
  },
  {
    id: "suika-master",
    name: "콩드랍 마스터",
    description: "콩드랍(수박게임) 전체 랭킹 1위 달성",
    image: "/assets/trophies/suika-master.png"
  },
  {
    id: "party-planner",
    name: "파티 플래너",
    description: "커스텀 파티 3개 이상 운영 중",
    image: "/assets/trophies/party-planner.png"
  },
  {
    id: "no-noshow-20",
    name: "불참 없이 참석 20회",
    description: "노쇼 없이 실제 참석 누적 20회 달성",
    image: "/assets/trophies/no-noshow-20.png"
  },
  {
    id: "five-day-streak",
    name: "5일 연속 참여",
    description: "달력상 연속 5일간 실제 참석",
    image: "/assets/trophies/five-day-streak.png"
  },
  {
    id: "weekend-regular",
    name: "주말 개근",
    description: "주말 이벤트 노쇼 없이 실제 참석 누적 10회 달성",
    image: "/assets/trophies/weekend-regular.png"
  }
```

새 함수 6개 추가 (`checkKongzTempTrophies` 뒤):

```js
function checkAnnualMemberTrophy(annualMember) {
  return annualMember === true ? ["annual-member"] : [];
}

function checkSuikaMasterTrophy(isTopScorer) {
  return isTopScorer ? ["suika-master"] : [];
}

function checkPartyPlannerTrophy(partyCount) {
  return partyCount >= 3 ? ["party-planner"] : [];
}

function checkNoNoshowTrophy(confirmedEventCount) {
  return confirmedEventCount >= 20 ? ["no-noshow-20"] : [];
}

function checkWeekendRegularTrophy(weekendConfirmedCount) {
  return weekendConfirmedCount >= 10 ? ["weekend-regular"] : [];
}

function hasConsecutiveDays(dateList, n) {
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

function checkFiveDayStreakTrophy(hasStreak) {
  return hasStreak ? ["five-day-streak"] : [];
}
```

`module.exports`에 6개 함수 모두 추가.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test trophies.test.js`
Expected: PASS (기존 23개 + 신규 15개 = 38개)

- [ ] **Step 5: Commit**

```bash
git add functions/trophies.js functions/trophies.test.js
git commit -m "feat: add annual-member, suika-master, party-planner, and posts-based trophy definitions"
```

---

## Task 4: `stats/global` 트리거 확장 — 파주귀신/글쓰기장인/인기만점/콩즈온도 통합

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Consumes: `checkWritingMasterTrophy`, `checkHeartthrobTrophy`, `checkKongzTempTrophies` (Task 1/2), 기존 `buildTrophyCandidates` (수정 대상)
- Produces: `buildTrophyCandidates(memberStats, fullCount)` — 반환값에 `writing-master`, `heartthrob`, `kongz-hot`, `so-hot`, 그리고 확장된 `checkAttendanceTrophies` 결과(paju-ghost 포함)까지 합쳐서 반환하도록 수정

- [ ] **Step 1: Write the failing tests**

`functions/index.test.js`의 기존 `buildTrophyCandidates` 테스트들 위치에 다음 테스트를 추가 (기존 두 테스트는 그대로 두고 이어서 추가):

```js
test("buildTrophyCandidates: 출석100+게시글30+평점10회5.0+온도62.5 모두 만족하면 전체 트로피 반환", () => {
  const memberStats = {
    attendCount: 100,
    postCount: 30,
    ratingCount: 10,
    ratingSum: { manner: 50, skill: 50, again: 50 }
  };
  const result = buildTrophyCandidates(memberStats, 5).sort();
  assert.deepStrictEqual(result, [
    "full-house-king",
    "heartthrob",
    "kongz-hot",
    "kongz-regular",
    "kongz-veteran",
    "paju-ghost-1",
    "paju-ghost-2",
    "paju-ghost-3",
    "schedule-maker",
    "so-hot",
    "writing-master"
  ].sort());
});

test("buildTrophyCandidates: 평점/온도 조건 미달이면 heartthrob/kongz-hot/so-hot 없음", () => {
  const memberStats = { attendCount: 0, postCount: 0, ratingCount: 0, ratingSum: {} };
  assert.deepStrictEqual(buildTrophyCandidates(memberStats, 0), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test index.test.js`
Expected: FAIL — 새 테스트의 기대값에 `writing-master`/`heartthrob`/`kongz-hot`/`so-hot`/`paju-ghost-*`가 빠져있어 실제 반환값과 불일치

- [ ] **Step 3: Write the implementation**

`functions/index.js`의 require 블록을 다음으로 교체:

```js
const {
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  checkWritingMasterTrophy,
  checkHeartthrobTrophy,
  checkKongzTempTrophies,
  newlyEarnedTrophyIds
} = require("./trophies.js");
```

`buildTrophyCandidates` 함수를 다음으로 교체:

```js
function buildTrophyCandidates(memberStats, fullCount) {
  if (!memberStats) return [];
  return [
    ...checkAttendanceTrophies(memberStats.attendCount || 0),
    ...checkScheduleMakerTrophy(memberStats.postCount || 0),
    ...checkWritingMasterTrophy(memberStats.postCount || 0),
    ...checkFullHouseTrophy(fullCount || 0),
    ...checkHeartthrobTrophy(memberStats),
    ...checkKongzTempTrophies(memberStats)
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test index.test.js`
Expected: PASS (기존 전체 + 신규 2개)

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: extend onStatsUpdated to award paju-ghost, writing-master, heartthrob, and temperature trophies"
```

---

## Task 5: `game_scores`/`suika_scores` 판정 로직 통합 — 콩드랍 마스터 트리거

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Consumes: `checkSuikaMasterTrophy` (Task 3), 기존 `isTopScorer` (재사용), 기존 `awardTrophies` (재사용)
- Produces:
  - `mapSuikaScores(docs)`: `Array<{uid, bestScore}>` — `suika_scores` 문서 배열(`{id, data: () => {best}}` 형태의 Firestore snapshot 문서가 아니라, 이미 `.data()`가 호출된 순수 객체 배열 `Array<{id, best}>`)을 받아 `isTopScorer`가 기대하는 `{uid, bestScore}` 형태로 매핑
  - Firestore 트리거 `exports.onSuikaScoreUpdated` (`onDocumentWritten("suika_scores/{uid}", ...)`)

- [ ] **Step 1: Write the failing test**

`functions/index.test.js`에 추가 — `suika_scores`의 `{id, best}` 형태를 `isTopScorer`가 기대하는 `{uid, bestScore}`로 매핑하는 어댑터 함수를 검증:

```js
test("mapSuikaScores: {id, best} 배열을 {uid, bestScore}로 매핑한다", () => {
  const docs = [{ id: "u1", best: 100 }, { id: "u2", best: 300 }];
  assert.deepStrictEqual(mapSuikaScores(docs), [
    { uid: "u1", bestScore: 100 },
    { uid: "u2", bestScore: 300 }
  ]);
});

test("mapSuikaScores: best 필드가 없으면 bestScore 0으로 매핑", () => {
  assert.deepStrictEqual(mapSuikaScores([{ id: "u1" }]), [{ uid: "u1", bestScore: 0 }]);
});

test("isTopScorer: mapSuikaScores로 매핑한 결과에도 동일하게 동작", () => {
  const mapped = mapSuikaScores([{ id: "u1", best: 100 }, { id: "u2", best: 300 }]);
  assert.strictEqual(isTopScorer(mapped, "u2"), true);
  assert.strictEqual(isTopScorer(mapped, "u1"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && node --test index.test.js`
Expected: FAIL with `mapSuikaScores is not a function`

- [ ] **Step 3: Write the implementation**

`functions/index.js`의 require 블록에 `checkSuikaMasterTrophy` 추가:

```js
const {
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  checkWritingMasterTrophy,
  checkHeartthrobTrophy,
  checkKongzTempTrophies,
  checkSuikaMasterTrophy,
  newlyEarnedTrophyIds
} = require("./trophies.js");
```

`exports.isTopScorer = isTopScorer;` 라인 뒤에 새 트리거 추가:

```js
function mapSuikaScores(docs) {
  return docs.map((d) => ({ uid: d.id, bestScore: d.best || 0 }));
}

exports.onSuikaScoreUpdated = onDocumentWritten("suika_scores/{uid}", async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;
  if (!afterData) return;

  const uid = event.params.uid;
  const db = getFirestore();

  try {
    const scoresSnap = await db.collection("suika_scores").get();
    const docs = scoresSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const allScores = mapSuikaScores(docs);
    const candidates = checkSuikaMasterTrophy(isTopScorer(allScores, uid));
    await awardTrophies(db, uid, candidates);
  } catch (err) {
    logger.error(`콩드랍 트로피 판정 실패 (uid: ${uid})`, err);
  }
});

exports.mapSuikaScores = mapSuikaScores;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test index.test.js`
Expected: PASS (기존 전체 + 신규 1개)

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: add onSuikaScoreUpdated trigger for suika-master trophy"
```

---

## Task 6: `parties` 트리거 — 파티 플래너

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Consumes: `checkPartyPlannerTrophy` (Task 3), 기존 `awardTrophies`
- Produces:
  - `countPartiesByOwner(parties, ownerUid)`: `number` — `parties: Array<{ownerUid}>` 중 `ownerUid`가 일치하는 개수
  - Firestore 트리거 `exports.onPartyUpdated` (`onDocumentWritten("parties/{partyId}", ...)`)

- [ ] **Step 1: Write the failing tests**

`functions/index.test.js`에 추가:

```js
const { countPartiesByOwner } = require("./index.js");

test("countPartiesByOwner: 특정 ownerUid의 파티만 센다", () => {
  const parties = [
    { ownerUid: "u1" },
    { ownerUid: "u1" },
    { ownerUid: "u2" }
  ];
  assert.strictEqual(countPartiesByOwner(parties, "u1"), 2);
});

test("countPartiesByOwner: 파티가 없으면 0", () => {
  assert.strictEqual(countPartiesByOwner([], "u1"), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test index.test.js`
Expected: FAIL with `countPartiesByOwner is not a function`

- [ ] **Step 3: Write the implementation**

`functions/index.js`의 require 블록에 `checkPartyPlannerTrophy` 추가.

새 함수와 트리거를 `exports.onSuikaScoreUpdated` 뒤에 추가:

```js
function countPartiesByOwner(parties, ownerUid) {
  return parties.filter((p) => p.ownerUid === ownerUid).length;
}

exports.onPartyUpdated = onDocumentWritten("parties/{partyId}", async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;
  if (!afterData || !afterData.ownerUid) return;

  const ownerUid = afterData.ownerUid;
  const db = getFirestore();

  try {
    const partiesSnap = await db.collection("parties").where("ownerUid", "==", ownerUid).get();
    const partyCount = countPartiesByOwner(partiesSnap.docs.map((d) => d.data()), ownerUid);
    const candidates = checkPartyPlannerTrophy(partyCount);
    await awardTrophies(db, ownerUid, candidates);
  } catch (err) {
    logger.error(`파티 플래너 트로피 판정 실패 (ownerUid: ${ownerUid})`, err);
  }
});

exports.countPartiesByOwner = countPartiesByOwner;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test index.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: add onPartyUpdated trigger for party-planner trophy"
```

---

## Task 7: `users` 트리거 — 연회원 가입

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Consumes: `checkAnnualMemberTrophy` (Task 3), 기존 `awardTrophies`
- Produces:
  - `becameAnnualMember(beforeData, afterData)`: `boolean` — `afterData?.annualMember === true`이고 `beforeData?.annualMember`가 `true`가 아니었으면 `true`
  - Firestore 트리거 `exports.onUserUpdated` (`onDocumentWritten("users/{uid}", ...)`)

- [ ] **Step 1: Write the failing tests**

`functions/index.test.js`에 추가:

```js
const { becameAnnualMember } = require("./index.js");

test("becameAnnualMember: annualMember가 false에서 true로 바뀌면 true", () => {
  assert.strictEqual(becameAnnualMember({ annualMember: false }, { annualMember: true }), true);
});

test("becameAnnualMember: 처음부터 undefined였다가 true가 되어도 true", () => {
  assert.strictEqual(becameAnnualMember(undefined, { annualMember: true }), true);
});

test("becameAnnualMember: 이미 true였다가 다시 true면 false (변화 없음)", () => {
  assert.strictEqual(becameAnnualMember({ annualMember: true }, { annualMember: true }), false);
});

test("becameAnnualMember: afterData가 없으면(삭제) false", () => {
  assert.strictEqual(becameAnnualMember({ annualMember: true }, undefined), false);
});

test("becameAnnualMember: annualMember가 여전히 false/undefined면 false", () => {
  assert.strictEqual(becameAnnualMember({ annualMember: false }, { annualMember: false }), false);
  assert.strictEqual(becameAnnualMember(undefined, {}), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test index.test.js`
Expected: FAIL with `becameAnnualMember is not a function`

- [ ] **Step 3: Write the implementation**

`functions/index.js`의 require 블록에 `checkAnnualMemberTrophy` 추가.

새 함수와 트리거를 `exports.onPartyUpdated` 뒤에 추가:

```js
function becameAnnualMember(beforeData, afterData) {
  if (!afterData) return false;
  const wasAnnual = beforeData?.annualMember === true;
  const isAnnual = afterData.annualMember === true;
  return isAnnual && !wasAnnual;
}

exports.onUserUpdated = onDocumentWritten("users/{uid}", async (event) => {
  const beforeData = event.data.before.exists ? event.data.before.data() : undefined;
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;

  if (!becameAnnualMember(beforeData, afterData)) return;

  const uid = event.params.uid;
  const db = getFirestore();

  try {
    const candidates = checkAnnualMemberTrophy(true);
    await awardTrophies(db, uid, candidates);
  } catch (err) {
    logger.error(`연회원 트로피 판정 실패 (uid: ${uid})`, err);
  }
});

exports.becameAnnualMember = becameAnnualMember;
```

**참고:** 기존 `notifyOnPendingSignup`도 같은 `users/{uid}` 경로에 `onDocumentWritten`을 걸고 있다. Firebase는 같은 문서 경로에 여러 트리거 함수(서로 다른 `exports` 이름)를 등록하는 것을 허용하므로 문제없이 공존한다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test index.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: add onUserUpdated trigger for annual-member trophy"
```

---

## Task 8: `posts` 트리거 — 불참없이 20회 / 5일 연속 / 주말 개근 통합 판정

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Consumes: `checkNoNoshowTrophy`, `checkFiveDayStreakTrophy`, `checkWeekendRegularTrophy`, `hasConsecutiveDays` (Task 3), 기존 `awardTrophies`
- Produces:
  - `confirmedAttendeesChanged(beforeData, afterData)`: `boolean` — `confirmedAttendees` 배열이 변경됐는지 (JSON 문자열 비교로 충분 — 순서까지 포함해 다르면 변경으로 간주, uid 배열이라 순서 변화 자체도 실질적 재계산 트리거로 취급해도 무해함)
  - `filterConfirmedClosedEvents(posts, uid)`: `Array<{eventDate}>` — `type === "event"`이고 `closedAt`이 존재하고 `confirmedAttendees`에 `uid`가 포함된 이벤트만 필터링
  - `isWeekendDate(date)`: `boolean` — `date.getDay()`가 0(일) 또는 6(토)이면 `true`
  - Firestore 트리거 `exports.onPostConfirmed` (`onDocumentWritten("posts/{postId}", ...)`)

- [ ] **Step 1: Write the failing tests**

`functions/index.test.js`에 추가:

```js
const { confirmedAttendeesChanged, filterConfirmedClosedEvents, isWeekendDate } = require("./index.js");

test("confirmedAttendeesChanged: 배열 내용이 바뀌면 true", () => {
  assert.strictEqual(
    confirmedAttendeesChanged({ confirmedAttendees: ["a"] }, { confirmedAttendees: ["a", "b"] }),
    true
  );
});

test("confirmedAttendeesChanged: 동일하면 false", () => {
  assert.strictEqual(
    confirmedAttendeesChanged({ confirmedAttendees: ["a", "b"] }, { confirmedAttendees: ["a", "b"] }),
    false
  );
});

test("confirmedAttendeesChanged: beforeData 없이 처음 설정되면 true", () => {
  assert.strictEqual(confirmedAttendeesChanged(undefined, { confirmedAttendees: ["a"] }), true);
});

test("confirmedAttendeesChanged: 둘 다 없으면 false", () => {
  assert.strictEqual(confirmedAttendeesChanged({}, {}), false);
});

test("filterConfirmedClosedEvents: type/closedAt/confirmedAttendees 조건 모두 만족하는 것만", () => {
  const posts = [
    { type: "event", closedAt: {}, confirmedAttendees: ["u1"], eventDate: "d1" },
    { type: "event", closedAt: null, confirmedAttendees: ["u1"], eventDate: "d2" },
    { type: "event", closedAt: {}, confirmedAttendees: ["u2"], eventDate: "d3" },
    { type: "notice", closedAt: {}, confirmedAttendees: ["u1"], eventDate: "d4" }
  ];
  const result = filterConfirmedClosedEvents(posts, "u1");
  assert.deepStrictEqual(result, [{ type: "event", closedAt: {}, confirmedAttendees: ["u1"], eventDate: "d1" }]);
});

test("filterConfirmedClosedEvents: 조건 만족하는 게 없으면 빈 배열", () => {
  assert.deepStrictEqual(filterConfirmedClosedEvents([], "u1"), []);
});

test("isWeekendDate: 토요일/일요일은 true, 평일은 false", () => {
  assert.strictEqual(isWeekendDate(new Date("2026-01-03")), true); // 토요일
  assert.strictEqual(isWeekendDate(new Date("2026-01-04")), true); // 일요일
  assert.strictEqual(isWeekendDate(new Date("2026-01-05")), false); // 월요일
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && node --test index.test.js`
Expected: FAIL — 세 함수 모두 `is not a function`

- [ ] **Step 3: Write the implementation**

`functions/index.js`의 require 블록에 `checkNoNoshowTrophy`, `checkFiveDayStreakTrophy`, `checkWeekendRegularTrophy`, `hasConsecutiveDays` 추가:

```js
const {
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  checkGame2048Trophy,
  checkWritingMasterTrophy,
  checkHeartthrobTrophy,
  checkKongzTempTrophies,
  checkSuikaMasterTrophy,
  checkAnnualMemberTrophy,
  checkPartyPlannerTrophy,
  checkNoNoshowTrophy,
  checkFiveDayStreakTrophy,
  checkWeekendRegularTrophy,
  hasConsecutiveDays,
  newlyEarnedTrophyIds
} = require("./trophies.js");
```

새 함수 3개와 트리거를 `exports.onUserUpdated` 뒤에 추가:

```js
function confirmedAttendeesChanged(beforeData, afterData) {
  const before = JSON.stringify(beforeData?.confirmedAttendees || null);
  const after = JSON.stringify(afterData?.confirmedAttendees || null);
  return before !== after;
}

function filterConfirmedClosedEvents(posts, uid) {
  return posts.filter(
    (p) => p.type === "event" && !!p.closedAt && (p.confirmedAttendees || []).includes(uid)
  );
}

function isWeekendDate(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

exports.onPostConfirmed = onDocumentWritten("posts/{postId}", async (event) => {
  const beforeData = event.data.before.exists ? event.data.before.data() : undefined;
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;

  if (!afterData || !confirmedAttendeesChanged(beforeData, afterData)) return;

  const db = getFirestore();
  const confirmedUids = afterData.confirmedAttendees || [];

  for (const uid of confirmedUids) {
    try {
      const postsSnap = await db
        .collection("posts")
        .where("type", "==", "event")
        .where("confirmedAttendees", "array-contains", uid)
        .get();

      const confirmedEvents = filterConfirmedClosedEvents(
        postsSnap.docs.map((d) => d.data()),
        uid
      );

      const eventDates = confirmedEvents
        .map((p) => p.eventDate?.toDate?.())
        .filter((d) => d instanceof Date);

      const weekendCount = eventDates.filter(isWeekendDate).length;
      const hasStreak = hasConsecutiveDays(eventDates, 5);

      const candidates = [
        ...checkNoNoshowTrophy(confirmedEvents.length),
        ...checkWeekendRegularTrophy(weekendCount),
        ...checkFiveDayStreakTrophy(hasStreak)
      ];

      await awardTrophies(db, uid, candidates);
    } catch (err) {
      logger.error(`참석 확정 트로피 판정 실패 (uid: ${uid})`, err);
    }
  }
});

exports.confirmedAttendeesChanged = confirmedAttendeesChanged;
exports.filterConfirmedClosedEvents = filterConfirmedClosedEvents;
exports.isWeekendDate = isWeekendDate;
```

**참고:** `posts` 컬렉션에 `type`+`confirmedAttendees`(array-contains) 복합 쿼리용 색인이 배포 후 필요할 수 있다 — 기존 `onStatsUpdated`의 `type`+`authorUid` 색인과 마찬가지로 첫 실행 시 에러 로그의 링크로 생성.

이 트리거는 확정된 참석자 수만큼 매번 전체 posts 쿼리를 반복 실행한다(예: 참석자 5명 확정 시 쿼리 5회). 클럽 규모(회원 수십 명)에서는 허용 가능한 수준이나, 사이트 성장 시 배치 처리를 고려할 수 있다는 점을 인지하고 진행한다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && node --test index.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: add onPostConfirmed trigger for no-noshow, five-day-streak, and weekend-regular trophies"
```

---

## Task 9: 클라이언트 트로피 메타 확장

**Files:**
- Modify: `assets/js/trophies-meta.js`
- Modify: `assets/js/trophies-meta.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: `TROPHIES_META` — 18개 항목으로 확장된 배열 (기존 5개 + 신규 13개, `functions/trophies.js`의 `TROPHIES`와 완전히 동일한 내용)

- [ ] **Step 1: Write the failing test**

`assets/js/trophies-meta.test.mjs`의 두 번째 테스트(id 목록 검증)를 다음으로 교체:

```js
test("TROPHIES_META: 18개 트로피, id 목록이 functions/trophies.js와 동일하다", () => {
  assert.strictEqual(TROPHIES_META.length, 18);
  const ids = TROPHIES_META.map((t) => t.id).sort();
  assert.deepStrictEqual(ids, [
    "annual-member",
    "five-day-streak",
    "full-house-king",
    "game-2048-champion",
    "heartthrob",
    "kongz-hot",
    "kongz-regular",
    "kongz-veteran",
    "no-noshow-20",
    "paju-ghost-1",
    "paju-ghost-2",
    "paju-ghost-3",
    "party-planner",
    "schedule-maker",
    "so-hot",
    "suika-master",
    "weekend-regular",
    "writing-master"
  ].sort());
});
```

첫 번째 테스트(구조 검증, `TROPHIES_META.length`를 5로 검증하던 부분이 있다면)도 함께 확인해 `18`로 갱신한다:

```js
test("TROPHIES_META: 각 트로피가 id/name/description/image를 보유", () => {
  assert.strictEqual(TROPHIES_META.length, 18);
  TROPHIES_META.forEach((t) => {
    assert.ok(typeof t.id === "string" && t.id.length > 0);
    assert.ok(typeof t.name === "string" && t.name.length > 0);
    assert.ok(typeof t.description === "string" && t.description.length > 0);
    assert.strictEqual(t.image, `/assets/trophies/${t.id}.png`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test assets/js/trophies-meta.test.mjs`
Expected: FAIL — `TROPHIES_META.length`가 5라서 18과 불일치, id 목록도 불일치

- [ ] **Step 3: Write the implementation**

`assets/js/trophies-meta.js`의 `TROPHIES_META` 배열에 13개 항목 추가 (기존 5개 뒤에 이어서, `functions/trophies.js`의 `TROPHIES`와 완전히 동일한 내용):

```js
  {
    id: "paju-ghost-1",
    name: "파주 귀신 I",
    description: "누적 출석 50회 달성",
    image: "/assets/trophies/paju-ghost-1.png"
  },
  {
    id: "paju-ghost-2",
    name: "파주 귀신 II",
    description: "누적 출석 75회 달성",
    image: "/assets/trophies/paju-ghost-2.png"
  },
  {
    id: "paju-ghost-3",
    name: "파주 귀신 III",
    description: "누적 출석 100회 달성",
    image: "/assets/trophies/paju-ghost-3.png"
  },
  {
    id: "writing-master",
    name: "글쓰기 장인",
    description: "누적 게시글 30개 등록",
    image: "/assets/trophies/writing-master.png"
  },
  {
    id: "heartthrob",
    name: "인기 만점",
    description: "평균 평점 4.5 이상 (10회 이상 평가받음)",
    image: "/assets/trophies/heartthrob.png"
  },
  {
    id: "kongz-hot",
    name: "콩즈 온도왕",
    description: "콩즈 온도 60도 이상 달성",
    image: "/assets/trophies/kongz-hot.png"
  },
  {
    id: "so-hot",
    name: "쏘핫",
    description: "콩즈 온도 62도 이상 달성",
    image: "/assets/trophies/so-hot.png"
  },
  {
    id: "annual-member",
    name: "연회원 가입",
    description: "연회원으로 가입",
    image: "/assets/trophies/annual-member.png"
  },
  {
    id: "suika-master",
    name: "콩드랍 마스터",
    description: "콩드랍(수박게임) 전체 랭킹 1위 달성",
    image: "/assets/trophies/suika-master.png"
  },
  {
    id: "party-planner",
    name: "파티 플래너",
    description: "커스텀 파티 3개 이상 운영 중",
    image: "/assets/trophies/party-planner.png"
  },
  {
    id: "no-noshow-20",
    name: "불참 없이 참석 20회",
    description: "노쇼 없이 실제 참석 누적 20회 달성",
    image: "/assets/trophies/no-noshow-20.png"
  },
  {
    id: "five-day-streak",
    name: "5일 연속 참여",
    description: "달력상 연속 5일간 실제 참석",
    image: "/assets/trophies/five-day-streak.png"
  },
  {
    id: "weekend-regular",
    name: "주말 개근",
    description: "주말 이벤트 노쇼 없이 실제 참석 누적 10회 달성",
    image: "/assets/trophies/weekend-regular.png"
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test assets/js/trophies-meta.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add assets/js/trophies-meta.js assets/js/trophies-meta.test.mjs
git commit -m "feat: sync client trophy metadata with 13 new server-side trophy definitions"
```

---

## Task 10: 통합 확인 — 전체 테스트 + 메타 동기화 검증

**Files:** 없음 (검증 전용 태스크)

**Interfaces:** 없음

- [ ] **Step 1: 전체 functions 테스트 실행**

Run: `cd functions && node --test`
Expected: 모든 테스트 PASS (기존 테스트 + Task 1~8에서 추가한 트로피 관련 테스트 전부)

- [ ] **Step 2: 전체 클라이언트 테스트 실행**

Run: `node --test assets/js/*.test.mjs`
Expected: 모든 테스트 PASS

- [ ] **Step 3: `functions/trophies.js`와 `assets/js/trophies-meta.js`의 id 목록이 일치하는지 확인**

```bash
node -e "
const { TROPHIES } = require('./functions/trophies.js');
console.log(TROPHIES.map(t => t.id).sort().join(','));
"
node -e "
import('./assets/js/trophies-meta.js').then(m => {
  console.log(m.TROPHIES_META.map(t => t.id).sort().join(','));
});
"
```

Expected: 두 출력이 동일한, 18개 id가 정렬된 문자열.

- [ ] **Step 4: Commit (변경사항 있을 경우에만)**

이 태스크는 검증 전용이라 코드 변경이 없다면 커밋하지 않는다.

---

## Out of Scope (spec과 동일)

- `posts` 트리거의 uid별 반복 쿼리를 배치/캐싱으로 최적화하는 작업
- 파티가 삭제되어 3개 미만이 되었을 때 `party-planner` 트로피를 회수하는 기능
- "인기 만점"의 계산식을 콩즈 온도와 같은 가중 평균으로 통일하는 것
- 트로피 이미지 파일 실제 제작
- `posts`의 `type`+`confirmedAttendees` 복합 색인을 사전에 수동 생성하는 작업 (첫 배포 후 에러 로그 링크로 생성)
