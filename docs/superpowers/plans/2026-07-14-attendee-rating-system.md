# 참석자 상호 평점 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임 일정 참석자들이 일정 종료 후 서로를 5점 척도(매너/실력/재만남)로 1회씩 평가하고, 누적 평균이 마이페이지와 참석자 hover 카드에 노출되게 한다.

**Architecture:** 순수 판정/계산 로직(평가 대상자 계산, 자정 경과 판정, 평균 계산)을 `assets/js/rating-logic.js`에 분리해 `node --test`로 단위 테스트한다. Firestore I/O와 DOM 조작은 기존 패턴(`post.js`가 `runTransaction`+`setDoc(merge)`로 `stats/global`을 갱신하는 방식, `board.js`의 hover 카드 패턴)을 그대로 재사용해 `post.js`, `mypage.js`, `board.js`에 통합한다.

**Tech Stack:** Firebase Firestore (v10.12.2 CDN import, 기존 프로젝트와 동일), Jekyll 정적 페이지(html), vanilla JS(ESM), `node --test`.

## Global Constraints

- 평가 항목: 매너, 실력, 재만남 의향 3개, 각 1~5점. 불참 표시 시 점수 필드 없음.
- 평가는 1회 제출로 고정(수정 불가) — Firestore 문서 ID를 `${postId}_${raterUid}_${targetUid}`로 고정해 재제출을 구조적으로 차단한다.
- 평가 대상: `posts.confirmedAttendees`가 있으면 그 목록, 없으면 `posts.attendees` 전체로 fallback.
- 평가 가능 시점: 클라이언트 기준 오늘이 `eventDate` 다음날 00:00 이후. 서버 사이드(Firestore rules/Cloud Functions) 시간 검증은 하지 않는다.
- 평균/횟수는 `stats/global` 문서의 `members.{uid}.ratingSum.{manner,skill,again}`, `members.{uid}.ratingCount`에 `increment()`로 누적하고, 조회 시 `sum/count`로 계산한다(별도 저장 없음). noShow 평가는 카운트에서 제외.
- hover 카드는 열람 조건 없이 항상 공개(blind exchange 없음).
- 리더보드는 이번 스코프에서 구현하지 않는다.
- 기존 코드 스타일 유지: 인라인 스타일 다수 사용, `escapeHtml`을 통한 XSS 방지, `getUserDoc(uid)`로 닉네임 조회.

---

## File Structure

- **Create** `assets/js/rating-logic.js` — 순수 함수만: 평가 대상자 목록 계산, 평가 가능 시점 판정, 평균/자기 자신 제외 필터, 평가 완료 여부 판정. Firestore/DOM 의존 없음 → 테스트 가능.
- **Create** `assets/js/rating-logic.test.mjs` — 위 순수 함수 단위 테스트. `suika-logic.test.mjs`와 동일한 `node --test` 패턴.
- **Modify** `post.html` — 출석 확정 섹션, 평가 섹션 마크업 추가.
- **Modify** `assets/js/post.js` — 출석 확정 UI 로직, 평가 제출 UI 로직, 참석자 hover 카드 바인딩 추가.
- **Modify** `assets/css/pages.css` — 출석 확정 체크박스, 평가 별점 UI, hover 카드 스타일 추가.
- **Modify** `mypage.html` — "내 평균 점수" 섹션 마크업 추가.
- **Modify** `assets/js/mypage.js` — `stats/global`에서 본인 평균 조회해 렌더링.

---

## Task 1: 순수 로직 함수 작성 (rating-logic.js)

**Files:**
- Create: `assets/js/rating-logic.js`
- Test: `assets/js/rating-logic.test.mjs`

**Interfaces:**
- Consumes: 없음 (순수 함수, 입력은 일반 객체/배열)
- Produces:
  - `getRatingTargets(postData, currentUid) => string[]` — 평가 대상 uid 배열(본인 제외, confirmedAttendees 우선, 없으면 attendees fallback)
  - `canRateNow(eventDate, now = new Date()) => boolean` — `eventDate`(JS `Date`) 다음날 00:00 이후인지
  - `ratingDocId(postId, raterUid, targetUid) => string` — `${postId}_${raterUid}_${targetUid}`
  - `computeAverages(memberStats) => { manner: number|null, skill: number|null, again: number|null, count: number }` — `memberStats`는 `{ ratingSum: {manner,skill,again}, ratingCount }` 형태. `ratingCount`가 0이면 세 평균 모두 `null`. 평균은 소수 첫째자리로 반올림(`Math.round(x*10)/10`).

- [ ] **Step 1: Write the failing tests**

```javascript
// assets/js/rating-logic.test.mjs
import assert from "node:assert";
import { test } from "node:test";
import {
  getRatingTargets, canRateNow, ratingDocId, computeAverages
} from "./rating-logic.js";

test("getRatingTargets: confirmedAttendees가 있으면 그것을 사용하고 본인 제외", () => {
  const post = { attendees: ["a", "b", "c"], confirmedAttendees: ["a", "b"] };
  assert.deepStrictEqual(getRatingTargets(post, "a"), ["b"]);
});

test("getRatingTargets: confirmedAttendees가 없으면 attendees로 fallback", () => {
  const post = { attendees: ["a", "b", "c"] };
  assert.deepStrictEqual(getRatingTargets(post, "a"), ["b", "c"]);
});

test("getRatingTargets: attendees도 없으면 빈 배열", () => {
  assert.deepStrictEqual(getRatingTargets({}, "a"), []);
});

test("canRateNow: eventDate 당일 23:59는 아직 불가", () => {
  const eventDate = new Date("2026-07-10T00:00:00");
  const now = new Date("2026-07-10T23:59:00");
  assert.strictEqual(canRateNow(eventDate, now), false);
});

test("canRateNow: eventDate 다음날 00:00 이후는 가능", () => {
  const eventDate = new Date("2026-07-10T00:00:00");
  const now = new Date("2026-07-11T00:00:01");
  assert.strictEqual(canRateNow(eventDate, now), true);
});

test("canRateNow: eventDate 다음날 자정 정각도 가능", () => {
  const eventDate = new Date("2026-07-10T19:00:00");
  const now = new Date("2026-07-11T00:00:00");
  assert.strictEqual(canRateNow(eventDate, now), true);
});

test("ratingDocId: postId_raterUid_targetUid 형식", () => {
  assert.strictEqual(ratingDocId("post1", "userA", "userB"), "post1_userA_userB");
});

test("computeAverages: ratingCount가 0이면 전부 null", () => {
  const result = computeAverages({ ratingSum: { manner: 0, skill: 0, again: 0 }, ratingCount: 0 });
  assert.deepStrictEqual(result, { manner: null, skill: null, again: null, count: 0 });
});

test("computeAverages: memberStats가 undefined면 전부 null, count 0", () => {
  assert.deepStrictEqual(computeAverages(undefined), { manner: null, skill: null, again: null, count: 0 });
});

test("computeAverages: 합/횟수로 평균을 소수 첫째자리까지 계산", () => {
  const result = computeAverages({ ratingSum: { manner: 14, skill: 9, again: 15 }, ratingCount: 3 });
  assert.deepStrictEqual(result, { manner: 4.7, skill: 3, again: 5, count: 3 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test assets/js/rating-logic.test.mjs`
Expected: FAIL — `Cannot find module './rating-logic.js'` (파일이 아직 없음)

- [ ] **Step 3: Write minimal implementation**

```javascript
// assets/js/rating-logic.js
export function getRatingTargets(postData, currentUid) {
  const targets = postData.confirmedAttendees || postData.attendees || [];
  return targets.filter((uid) => uid !== currentUid);
}

export function canRateNow(eventDate, now = new Date()) {
  const cutoff = new Date(eventDate);
  cutoff.setHours(24, 0, 0, 0);
  return now.getTime() >= cutoff.getTime();
}

export function ratingDocId(postId, raterUid, targetUid) {
  return `${postId}_${raterUid}_${targetUid}`;
}

export function computeAverages(memberStats) {
  const count = memberStats?.ratingCount || 0;
  if (count === 0) return { manner: null, skill: null, again: null, count: 0 };
  const round1 = (x) => Math.round(x * 10) / 10;
  const sum = memberStats.ratingSum || {};
  return {
    manner: round1((sum.manner || 0) / count),
    skill: round1((sum.skill || 0) / count),
    again: round1((sum.again || 0) / count),
    count
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test assets/js/rating-logic.test.mjs`
Expected: `# pass 10`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add assets/js/rating-logic.js assets/js/rating-logic.test.mjs
git commit -m "feat: add pure rating-logic helpers with unit tests"
```

---

## Task 2: 출석 확정 UI (post.html + post.js)

**Files:**
- Modify: `post.html`
- Modify: `assets/js/post.js`

**Interfaces:**
- Consumes: `rating-logic.js`의 `getRatingTargets`는 사용하지 않음(이 태스크는 확정 자체만 다룸). 기존 `postData`, `currentUser`, `currentUserData`, `canEdit` 판정(`post.js:70`)을 재사용.
- Produces: `posts/{postId}.confirmedAttendees: string[]` 필드를 Firestore에 기록. Task 3, 4가 이 필드를 읽는다.

- [ ] **Step 1: post.html에 출석 확정 섹션 마크업 추가**

`section-attendees` 바로 다음, `section-comments` 앞에 삽입:

```html
  <!-- 출석 확정 섹션 (작성자 전용, event만) -->
  <div id="section-confirm-attendance" style="display:none" class="mt-4">
    <p class="attendee-section-title">출석 확정 <span style="font-weight:400;color:var(--text-muted);font-size:0.75rem">(작성자 전용)</span></p>
    <div id="confirm-attendance-list" class="mb-2"></div>
    <button id="btn-save-confirmed" class="btn-attend-action join">저장</button>
    <p id="msg-confirm-saved" class="page-msg page-msg--success" style="display:none">저장했습니다.</p>
  </div>
```

- [ ] **Step 2: post.js에 출석 확정 렌더링/저장 로직 추가**

`loadAttendees()` 정의부 바로 다음에 새 함수를 추가:

```javascript
async function setupConfirmAttendance() {
  const canConfirm = currentUser.uid === postData.authorUid || currentUserData.isAdmin;
  if (!canConfirm) return;

  const attendees = postData.attendees || [];
  if (!attendees.length) return;

  document.getElementById("section-confirm-attendance").style.display = "block";
  const confirmed = postData.confirmedAttendees || attendees;

  const names = await Promise.all(attendees.map(async (uid) => {
    const u = await getUserDoc(uid);
    return { uid, name: u?.nickname || "알 수 없음" };
  }));

  document.getElementById("confirm-attendance-list").innerHTML = names.map(({ uid, name }) => `
    <label style="display:flex;align-items:center;gap:6px;margin:4px 0;font-size:0.86rem">
      <input type="checkbox" class="confirm-attendance-checkbox" value="${escapeHtml(uid)}" ${confirmed.includes(uid) ? "checked" : ""}>
      ${escapeHtml(name)}
    </label>
  `).join("");

  document.getElementById("btn-save-confirmed").addEventListener("click", async () => {
    const checked = [...document.querySelectorAll(".confirm-attendance-checkbox:checked")].map((el) => el.value);
    await updateDoc(doc(db, "posts", postId), { confirmedAttendees: checked });
    postData.confirmedAttendees = checked;
    document.getElementById("msg-confirm-saved").style.display = "block";
  });
}
```

`loadPost()` 안에서 `postData.type === "event"` 블록(`post.js:124`) 내부, `await loadAttendees();` 다음 줄에 호출 추가:

```javascript
    await loadAttendees();
    await setupConfirmAttendance();
    setupAttendButtons();
```

- [ ] **Step 3: 브라우저에서 수동 확인**

로컬 서버로 event 타입 게시글 상세 페이지를 연다(예: `bundle exec jekyll serve` 또는 기존 개발 서버 실행 방법). 작성자 계정으로 접속 시 "출석 확정" 섹션이 보이고 체크박스 저장이 `confirmedAttendees`를 반영하는지, 비작성자 계정으로는 섹션이 안 보이는지 확인한다.

- [ ] **Step 4: Commit**

```bash
git add post.html assets/js/post.js
git commit -m "feat: add organizer attendance confirmation UI"
```

---

## Task 3: 평가 제출 UI (post.html + post.js)

**Files:**
- Modify: `post.html`
- Modify: `assets/js/post.js`

**Interfaces:**
- Consumes: `rating-logic.js`의 `getRatingTargets(postData, currentUser.uid)`, `canRateNow(postData.eventDate.toDate())`, `ratingDocId(postId, raterUid, targetUid)`
- Produces: `ratings/{ratingDocId}` 문서 생성, `stats/global.members.{targetUid}.ratingSum.*`/`ratingCount` 갱신. Task 4(hover), Task 5(마이페이지)가 이 데이터를 읽는다.

- [ ] **Step 1: post.js 상단 import에 rating-logic 함수 추가**

```javascript
import { getRatingTargets, canRateNow, ratingDocId } from "./rating-logic.js";
```

- [ ] **Step 2: post.html에 평가 섹션 마크업 추가**

`section-comments` 바로 앞에 삽입:

```html
  <!-- 평가 섹션 (참석자 전용, 자정 이후 노출) -->
  <div id="section-rating" style="display:none" class="mt-4">
    <p class="attendee-section-title">참석자 평가</p>
    <div id="rating-list"></div>
    <p id="msg-rating-done" class="page-msg page-msg--success" style="display:none">평가를 마쳤습니다.</p>
  </div>
```

- [ ] **Step 3: post.js에 평가 섹션 렌더링/제출 로직 추가**

`setupConfirmAttendance` 함수 다음에 추가:

```javascript
async function setupRatingSection() {
  if (!canRateNow(postData.eventDate.toDate())) return;
  const targets = getRatingTargets(postData, currentUser.uid);
  if (!targets.length) return;

  document.getElementById("section-rating").style.display = "block";

  const existing = await Promise.all(targets.map(async (targetUid) => {
    const snap = await getDoc(doc(db, "ratings", ratingDocId(postId, currentUser.uid, targetUid)));
    return [targetUid, snap.exists()];
  }));
  const submittedMap = Object.fromEntries(existing);

  if (targets.every((uid) => submittedMap[uid])) {
    document.getElementById("msg-rating-done").style.display = "block";
    return;
  }

  const names = await Promise.all(targets.map(async (uid) => {
    const u = await getUserDoc(uid);
    return { uid, name: u?.nickname || "알 수 없음" };
  }));

  document.getElementById("rating-list").innerHTML = names.map(({ uid, name }) => {
    if (submittedMap[uid]) {
      return `<div class="rating-row rating-row--done">
        <span class="rating-row-name">${escapeHtml(name)}</span>
        <span class="text-muted" style="font-size:0.8rem">제출 완료</span>
      </div>`;
    }
    return `<div class="rating-row" data-uid="${escapeHtml(uid)}">
      <span class="rating-row-name">${escapeHtml(name)}</span>
      <label class="rating-noshow"><input type="checkbox" class="rating-noshow-check"> 불참</label>
      <div class="rating-scores">
        <label>매너 <select class="rating-score" data-field="manner">${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join("")}</select></label>
        <label>실력 <select class="rating-score" data-field="skill">${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join("")}</select></label>
        <label>재만남 <select class="rating-score" data-field="again">${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join("")}</select></label>
      </div>
      <button class="btn-attend-action join btn-submit-rating">제출</button>
    </div>`;
  }).join("");

  document.getElementById("rating-list").querySelectorAll(".rating-row[data-uid]").forEach((row) => {
    const targetUid = row.dataset.uid;
    const noShowCheck = row.querySelector(".rating-noshow-check");
    const scoresEl = row.querySelector(".rating-scores");
    noShowCheck.addEventListener("change", () => {
      scoresEl.style.display = noShowCheck.checked ? "none" : "flex";
    });
    row.querySelector(".btn-submit-rating").addEventListener("click", async () => {
      const noShow = noShowCheck.checked;
      const payload = { postId, raterUid: currentUser.uid, targetUid, noShow, createdAt: serverTimestamp() };
      if (!noShow) {
        row.querySelectorAll(".rating-score").forEach((sel) => {
          payload[sel.dataset.field] = Number(sel.value);
        });
      }
      const ratingRef = doc(db, "ratings", ratingDocId(postId, currentUser.uid, targetUid));
      try {
        await runTransaction(db, async (tx) => {
          const existing = await tx.get(ratingRef);
          if (existing.exists()) throw new Error("이미 제출됨");
          tx.set(ratingRef, payload);
        });
      } catch (e) {
        alert("이미 제출된 평가이거나 오류가 발생했습니다.");
        return;
      }
      if (!noShow) {
        await setDoc(doc(db, "stats", "global"), {
          updatedAt: serverTimestamp(),
          [`members.${targetUid}.ratingSum.manner`]: increment(payload.manner),
          [`members.${targetUid}.ratingSum.skill`]: increment(payload.skill),
          [`members.${targetUid}.ratingSum.again`]: increment(payload.again),
          [`members.${targetUid}.ratingCount`]: increment(1)
        }, { merge: true });
      }
      location.reload();
    });
  });
}
```

`loadPost()`의 event 블록에서 `setupAttendButtons();` 다음 줄에 호출 추가:

```javascript
    await loadAttendees();
    await setupConfirmAttendance();
    setupAttendButtons();
    await setupRatingSection();
```

- [ ] **Step 4: pages.css에 평가 UI 스타일 추가**

`.attendee-chip` 규칙(`assets/css/pages.css:433` 부근) 다음에 추가:

```css
.rating-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 0;
  border-bottom: 1px solid var(--divider, #f0f0ee);
}
.rating-row-name {
  font-weight: 600;
  font-size: 0.86rem;
  min-width: 80px;
}
.rating-noshow {
  font-size: 0.78rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}
.rating-scores {
  display: flex;
  gap: 10px;
  font-size: 0.8rem;
}
.rating-row--done {
  justify-content: space-between;
  padding: 8px 0;
}
```

- [ ] **Step 5: 브라우저에서 수동 확인**

`eventDate`가 과거인 event 게시글(자정 지난 상태)에 참석자로 등록된 계정으로 접속 → 평가 섹션이 보이고, 한 명 제출 후 새로고침하면 "제출 완료"로 잠기는지, 전원 제출 후 "평가를 마쳤습니다"로 바뀌는지 확인. 같은 대상에게 두 번째 제출 시도 시 알림이 뜨는지(Firestore가 이미 문서 존재로 거부) 확인.

- [ ] **Step 6: Commit**

```bash
git add post.html assets/js/post.js assets/css/pages.css
git commit -m "feat: add attendee rating submission UI"
```

---

## Task 4: 참석자 hover 카드 (post.js + pages.css)

**Files:**
- Modify: `assets/js/post.js`
- Modify: `assets/css/pages.css`

**Interfaces:**
- Consumes: `rating-logic.js`의 `computeAverages(memberStats)`. `stats/global` 문서 읽기(`getDoc`).
- Produces: 없음(터미널 UI 기능)

- [ ] **Step 1: post.js import에 computeAverages 추가**

```javascript
import { getRatingTargets, canRateNow, ratingDocId, computeAverages } from "./rating-logic.js";
```

- [ ] **Step 2: loadAttendees()를 hover 바인딩이 가능하도록 수정**

기존 `loadAttendees()`(`post.js:133-144`)를 아래로 교체:

```javascript
async function loadAttendees() {
  const attendees = postData.attendees || [];
  document.getElementById("section-attendees").style.display = "block";
  document.getElementById("attendee-count").textContent = `(${attendees.length}/${postData.maxAttendees}명)`;

  const statsSnap = await getDoc(doc(db, "stats", "global"));
  const membersStats = statsSnap.data()?.members || {};

  const entries = await Promise.all(attendees.map(async (uid) => {
    const u = await getUserDoc(uid);
    return { uid, name: u?.nickname || "알 수 없음" };
  }));

  document.getElementById("attendee-list").innerHTML = entries
    .map(({ uid, name }) => `<span class="attendee-chip" data-uid="${escapeHtml(uid)}">${escapeHtml(name)}</span>`)
    .join("");

  document.querySelectorAll(".attendee-chip[data-uid]").forEach((chip) => {
    const uid = chip.dataset.uid;
    bindRatingHoverCard(chip, computeAverages(membersStats[uid]));
  });
}

let ratingHoverCardEl = null;
let ratingHoverHideTimer = null;

function getRatingHoverCard() {
  if (ratingHoverCardEl) return ratingHoverCardEl;
  ratingHoverCardEl = document.createElement("div");
  ratingHoverCardEl.className = "rating-hovercard";
  document.body.appendChild(ratingHoverCardEl);
  ratingHoverCardEl.addEventListener("mouseenter", () => clearTimeout(ratingHoverHideTimer));
  ratingHoverCardEl.addEventListener("mouseleave", scheduleHideRatingHoverCard);
  return ratingHoverCardEl;
}

function scheduleHideRatingHoverCard() {
  clearTimeout(ratingHoverHideTimer);
  ratingHoverHideTimer = setTimeout(() => {
    if (ratingHoverCardEl) ratingHoverCardEl.style.display = "none";
  }, 120);
}

function bindRatingHoverCard(anchorEl, averages) {
  anchorEl.addEventListener("mouseenter", () => {
    clearTimeout(ratingHoverHideTimer);
    const card = getRatingHoverCard();
    card.innerHTML = averages.count === 0
      ? `<p class="rating-hovercard-empty">아직 평가 없음</p>`
      : `<div class="rating-hovercard-scores">
          <span>매너 ${averages.manner}</span>
          <span>실력 ${averages.skill}</span>
          <span>재만남 ${averages.again}</span>
        </div>
        <p class="rating-hovercard-count">${averages.count}회 평가받음</p>`;
    card.style.display = "block";
    const rect = anchorEl.getBoundingClientRect();
    card.style.left = `${rect.left + window.scrollX}px`;
    card.style.top = `${rect.bottom + window.scrollY + 6}px`;
  });
  anchorEl.addEventListener("mouseleave", scheduleHideRatingHoverCard);
}
```

- [ ] **Step 3: pages.css에 hover 카드 스타일 추가**

`.rating-row--done` 규칙 다음에 추가:

```css
.rating-hovercard {
  display: none;
  position: absolute;
  z-index: 30;
  min-width: 160px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--card-border, #e8e8e4);
  border-radius: var(--radius, 8px);
  box-shadow: var(--card-shadow-hover, 0 6px 20px rgba(0,0,0,0.12));
  padding: 10px 12px;
  font-size: 0.78rem;
}
.rating-hovercard-scores {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text-primary);
  font-weight: 600;
}
.rating-hovercard-count {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}
.rating-hovercard-empty {
  margin: 0;
  color: var(--text-muted);
}
```

- [ ] **Step 4: 브라우저에서 수동 확인**

event 상세 페이지에서 평가를 받은 참석자와 받지 않은 참석자 각각의 chip에 마우스를 올려, 평균 점수/횟수 카드와 "아직 평가 없음" 카드가 올바르게 뜨는지 확인. 로그인 여부와 무관하게(평가 제출 여부와 무관하게) 항상 뜨는지 확인.

- [ ] **Step 5: Commit**

```bash
git add assets/js/post.js assets/css/pages.css
git commit -m "feat: show rating average hover card on attendee chips"
```

---

## Task 5: 마이페이지 "내 평균 점수" 섹션

**Files:**
- Modify: `mypage.html`
- Modify: `assets/js/mypage.js`

**Interfaces:**
- Consumes: `rating-logic.js`의 `computeAverages(memberStats)`. `stats/global` 문서 읽기.
- Produces: 없음(터미널 UI 기능)

- [ ] **Step 1: mypage.html에 평균 점수 섹션 마크업 추가**

`<hr style="margin:24px 0">` 바로 앞(회원 탈퇴 섹션 이전)에 삽입:

```html
      <div class="mb-4">
        <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:4px">내 평균 점수</div>
        <div id="info-rating"></div>
      </div>
```

- [ ] **Step 2: mypage.js import 및 렌더링 로직 추가**

파일 상단 import에 추가:

```javascript
import { doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { computeAverages } from "./rating-logic.js";
```

`requireApproved` 콜백 안, `document.getElementById("info-tags").innerHTML = tags.join(" ");` 다음 줄에 추가:

```javascript
  const statsSnap = await getDoc(doc(db, "stats", "global"));
  const myStats = statsSnap.data()?.members?.[user.uid];
  const averages = computeAverages(myStats);
  document.getElementById("info-rating").innerHTML = averages.count === 0
    ? `<div style="font-size:0.86rem;color:var(--text-muted)">아직 받은 평가가 없습니다.</div>`
    : `<div style="font-size:0.92rem;color:var(--text-secondary)">매너 ${averages.manner} · 실력 ${averages.skill} · 재만남 ${averages.again} <span style="color:var(--text-muted);font-size:0.78rem">(${averages.count}회 평가받음)</span></div>`;
```

- [ ] **Step 3: 브라우저에서 수동 확인**

평가를 받은 계정과 받지 않은 계정 각각으로 마이페이지에 접속해 "내 평균 점수" 섹션이 올바르게 표시되는지 확인.

- [ ] **Step 4: Commit**

```bash
git add mypage.html assets/js/mypage.js
git commit -m "feat: show average rating on mypage"
```

---

## Self-Review Notes

- **Spec coverage:** 흐름 요약 1-5(Task 2,3), 출석 확정(Task 2), 데이터 모델 3종(Task 1,2,3), 평가 섹션(Task 3), 점수 열람/마이페이지(Task 5), hover 열람(Task 4), 시간 판정(Task 1 `canRateNow`) 모두 태스크에 대응됨. 리더보드는 스펙에서도 out of scope로 명시되어 태스크 없음.
- **Placeholder scan:** 없음 — 모든 스텝에 실제 코드/명령 포함.
- **Type consistency:** `getRatingTargets`, `canRateNow`, `ratingDocId`, `computeAverages` 함수 시그니처가 Task 1에서 정의된 그대로 Task 2~5에서 동일하게 사용됨. `ratings` 문서 필드명(`postId`, `raterUid`, `targetUid`, `noShow`, `manner/skill/again`, `createdAt`)과 `stats/global` 필드 경로(`members.{uid}.ratingSum.*`, `ratingCount`)가 Task 3, 4, 5에서 일관됨.
