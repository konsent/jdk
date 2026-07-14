# BGG 게임 검색 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일정 등록 폼에서 BGG(BoardGameGeek) 게임을 검색해 여러 개를 선택, 일정에 태그처럼 붙이고 상세 페이지에 썸네일 카드로 보여준다.

**Architecture:** Firebase Functions(Node 20, v2, `onRequest`)에 BGG XML API 프록시 함수 2개(`searchBoardGame`, `getBoardGameDetail`)를 추가한다. 클라이언트(`write.js`)는 이 함수들을 호출해 검색 후보를 보여주고, 선택된 게임을 배열 상태로 들고 있다가 제출 시 `posts` 문서의 `games` 필드로 저장한다. 상세 페이지(`post.js`)는 `games` 배열이 있으면 썸네일 카드 목록을 렌더링한다.

**Tech Stack:** Firebase Functions v2 (Node 20, CommonJS), `node:test` (내장 테스트 러너, 별도 프레임워크 없음), 바닐라 JS ES 모듈, Firestore, 순수 CSS(기존 `pages.css` 변수 재사용).

## Global Constraints

- BGG XML API는 CORS 미지원 — 클라이언트에서 직접 호출 금지, 반드시 Firebase Functions 경유.
- BGG 202(캐시 준비 중) 응답 시 1회만 짧게 재시도, 그래도 실패하면 빈 배열/`null`과 함께 HTTP 200 반환 — 검색 실패가 폼 제출을 막으면 안 됨.
- 게임 선택은 선택 사항. `games` 필드가 없거나 빈 배열인 일정도 유효.
- XML 파싱에 새 npm 패키지를 추가하지 않는다 — 필요한 필드(id, name, yearPublished, thumbnail)만 추출하는 간단한 정규식 기반 파싱으로 충분(YAGNI).
- 테스트는 `node --test`로 실행되는 기존 방식을 따른다(`functions/index.test.js`에 추가).
- 신규 함수는 리전 지정 없이 기본 리전(`us-central1`)을 사용한다 — 기존 함수들과 동일.

---

## 파일 구조

- `functions/index.js` — 수정: BGG 검색/상세조회 프록시 함수 2개, XML 파싱 헬퍼 3개(검색 결과 파싱, 단일 아이템 파싱, 공통 재시도 래퍼) 추가.
- `functions/index.test.js` — 수정: 파싱 헬퍼에 대한 단위 테스트 추가(고정 XML 샘플 사용, 네트워크 호출 없음).
- `assets/js/write.js` — 수정: 게임 검색 UI 로직, 선택된 게임 배열 상태 관리, 제출 시 `games` 필드 포함.
- `write.html` — 수정: 게임 검색 input + 후보 드롭다운 + 선택된 게임 태그 목록 마크업 추가.
- `assets/js/post.js` — 수정: `postData.games`가 있으면 게임 카드 섹션 렌더링.
- `assets/css/pages.css` — 수정: 게임 후보 드롭다운, 선택된 게임 태그, 상세 페이지 게임 카드 스타일 추가(기존 `--card-bg`, `--card-border`, `--card-shadow` 변수 재사용).

---

### Task 1: BGG 프록시 Functions — 검색

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Produces: `parseSearchResults(xml)` — XML 문자열 → `[{ bggId, name, yearPublished }]` 배열. `exports.parseSearchResults`.
- Produces: `exports.searchBoardGame` — `onRequest` HTTPS 함수, `req.query.q` 받아 JSON 배열 응답.

- [ ] **Step 1: 실패하는 파싱 테스트 작성**

`functions/index.test.js` 끝에 추가:

```js
const { parseSearchResults } = require("./index.js");

test("parseSearchResults: 검색 결과 XML에서 id/name/연도를 추출한다", () => {
  const xml = `<?xml version="1.0"?>
<items total="2" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="13">
  <name type="primary" value="CATAN"/>
  <yearpublished value="1995"/>
</item>
<item type="boardgame" id="9209">
  <name type="primary" value="Catan: Cities and Knights"/>
  <yearpublished value="1998"/>
</item>
</items>`;
  assert.deepStrictEqual(parseSearchResults(xml), [
    { bggId: "13", name: "CATAN", yearPublished: "1995" },
    { bggId: "9209", name: "Catan: Cities and Knights", yearPublished: "1998" }
  ]);
});

test("parseSearchResults: 결과 없으면 빈 배열", () => {
  const xml = `<?xml version="1.0"?><items total="0" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"></items>`;
  assert.deepStrictEqual(parseSearchResults(xml), []);
});

test("parseSearchResults: yearpublished 없는 아이템은 yearPublished undefined", () => {
  const xml = `<?xml version="1.0"?>
<items total="1" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="42">
  <name type="primary" value="Mystery Game"/>
</item>
</items>`;
  assert.deepStrictEqual(parseSearchResults(xml), [
    { bggId: "42", name: "Mystery Game", yearPublished: undefined }
  ]);
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd functions && node --test`
Expected: FAIL — `parseSearchResults is not a function` (또는 `undefined`)

- [ ] **Step 3: `parseSearchResults` 및 `searchBoardGame` 구현**

`functions/index.js` 상단 import 구역에 추가:

```js
const { onRequest } = require("firebase-functions/v2/https");
```

파일 끝(`exports.buildMessage = buildMessage;` 다음)에 추가:

```js
function parseSearchResults(xml) {
  const items = [];
  const itemRegex = /<item[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const [, bggId, body] = match;
    const nameMatch = /<name[^>]*\bvalue="([^"]*)"/.exec(body);
    const yearMatch = /<yearpublished[^>]*\bvalue="([^"]*)"/.exec(body);
    items.push({
      bggId,
      name: nameMatch ? nameMatch[1] : "",
      yearPublished: yearMatch ? yearMatch[1] : undefined
    });
  }
  return items;
}

async function fetchWithRetry(url) {
  let res = await fetch(url);
  if (res.status === 202) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await fetch(url);
  }
  if (!res.ok) return null;
  return res.text();
}

exports.searchBoardGame = onRequest(async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) { res.json([]); return; }
  try {
    const xml = await fetchWithRetry(
      `https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=${encodeURIComponent(q)}`
    );
    res.json(xml ? parseSearchResults(xml) : []);
  } catch (err) {
    logger.error("BGG 검색 실패", err);
    res.json([]);
  }
});

exports.parseSearchResults = parseSearchResults;
exports.fetchWithRetry = fetchWithRetry;
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd functions && node --test`
Expected: PASS (전체 테스트 9개)

- [ ] **Step 5: 커밋**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: add BGG board game search proxy function"
```

---

### Task 2: BGG 프록시 Functions — 상세 조회(썸네일 포함)

**Files:**
- Modify: `functions/index.js`
- Test: `functions/index.test.js`

**Interfaces:**
- Consumes: `fetchWithRetry(url)` (Task 1에서 정의)
- Produces: `parseGameDetail(xml)` — XML 문자열 → `{ bggId, name, yearPublished, thumbnail } | null`. `exports.parseGameDetail`.
- Produces: `exports.getBoardGameDetail` — `onRequest` HTTPS 함수, `req.query.id` 받아 JSON 객체 응답.

- [ ] **Step 1: 실패하는 파싱 테스트 작성**

`functions/index.test.js`에 추가:

```js
const { parseGameDetail } = require("./index.js");

test("parseGameDetail: thing XML에서 이름/연도/썸네일을 추출한다", () => {
  const xml = `<?xml version="1.0"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="13">
  <thumbnail>https://cf.geekdo-images.com/thumb/catan.jpg</thumbnail>
  <image>https://cf.geekdo-images.com/full/catan.jpg</image>
  <name type="primary" sortindex="1" value="Catan"/>
  <name type="alternate" sortindex="1" value="Los Colonos de Catan"/>
  <yearpublished value="1995"/>
</item>
</items>`;
  assert.deepStrictEqual(parseGameDetail(xml, "13"), {
    bggId: "13",
    name: "Catan",
    yearPublished: "1995",
    thumbnail: "https://cf.geekdo-images.com/thumb/catan.jpg"
  });
});

test("parseGameDetail: 아이템이 없으면 null", () => {
  const xml = `<?xml version="1.0"?><items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"></items>`;
  assert.strictEqual(parseGameDetail(xml, "999"), null);
});

test("parseGameDetail: thumbnail 없으면 thumbnail undefined", () => {
  const xml = `<?xml version="1.0"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="42">
  <name type="primary" sortindex="1" value="Mystery Game"/>
  <yearpublished value="2020"/>
</item>
</items>`;
  assert.deepStrictEqual(parseGameDetail(xml, "42"), {
    bggId: "42",
    name: "Mystery Game",
    yearPublished: "2020",
    thumbnail: undefined
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd functions && node --test`
Expected: FAIL — `parseGameDetail is not a function`

- [ ] **Step 3: `parseGameDetail` 및 `getBoardGameDetail` 구현**

`functions/index.js` 파일 끝에 추가(Task 1의 exports 아래):

```js
function parseGameDetail(xml, bggId) {
  const itemMatch = /<item[^>]*\bid="[^"]+"[^>]*>([\s\S]*?)<\/item>/.exec(xml);
  if (!itemMatch) return null;
  const body = itemMatch[1];
  const nameMatch = /<name[^>]*\btype="primary"[^>]*\bvalue="([^"]*)"/.exec(body);
  const yearMatch = /<yearpublished[^>]*\bvalue="([^"]*)"/.exec(body);
  const thumbMatch = /<thumbnail>([^<]*)<\/thumbnail>/.exec(body);
  return {
    bggId,
    name: nameMatch ? nameMatch[1] : "",
    yearPublished: yearMatch ? yearMatch[1] : undefined,
    thumbnail: thumbMatch ? thumbMatch[1] : undefined
  };
}

exports.getBoardGameDetail = onRequest(async (req, res) => {
  const id = (req.query.id || "").trim();
  if (!id) { res.json(null); return; }
  try {
    const xml = await fetchWithRetry(
      `https://boardgamegeek.com/xmlapi2/thing?id=${encodeURIComponent(id)}`
    );
    res.json(xml ? parseGameDetail(xml, id) : null);
  } catch (err) {
    logger.error("BGG 상세 조회 실패", err);
    res.json(null);
  }
});

exports.parseGameDetail = parseGameDetail;
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd functions && node --test`
Expected: PASS (전체 테스트 12개)

- [ ] **Step 5: 커밋**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: add BGG board game detail proxy function"
```

---

### Task 3: write.html — 게임 검색 UI 마크업

**Files:**
- Modify: `write.html`

**Interfaces:**
- Produces: DOM 요소 id들 — `input-game-search`, `game-candidates`, `selected-games` — Task 4(write.js)가 이 id로 요소를 조회.

- [ ] **Step 1: `section-event-fields` 안, 최대 참석 인원 필드 다음에 게임 검색 마크업 추가**

`write.html`의 `<div class="mb-3">` (최대 참석 인원 블록) 바로 뒤, `</div>` (section-event-fields 닫는 태그) 이전에 추가:

```html
        <div class="mb-3">
          <label class="form-label">함께할 게임</label>
          <div style="position:relative">
            <input type="text" id="input-game-search" class="form-control" placeholder="게임 이름을 검색하세요 (예: 카탄)" autocomplete="off">
            <div id="game-candidates" class="game-candidates" style="display:none"></div>
          </div>
          <div id="selected-games" class="selected-games"></div>
        </div>
```

- [ ] **Step 2: 브라우저에서 `/write/` 열어 마크업이 깨지지 않았는지 눈으로 확인**

Run: 로컬에서 Jekyll을 띄울 수 없다면 이 단계는 생략하고 Task 6에서 통합 확인. Jekyll이 이미 떠 있다면 `bundle exec jekyll serve` 후 `http://localhost:4000/write/` 접속, "함께할 게임" 입력창이 최대 참석 인원 아래에 보이는지 확인.
Expected: 입력창과 (숨겨진) 후보/태그 영역이 레이아웃 깨짐 없이 표시됨.

- [ ] **Step 3: 커밋**

```bash
git add write.html
git commit -m "feat: add game search markup to event write form"
```

---

### Task 4: write.js — 게임 검색/선택 로직

**Files:**
- Modify: `assets/js/write.js`

**Interfaces:**
- Consumes: `searchBoardGame`/`getBoardGameDetail` HTTPS 엔드포인트 (Task 1, 2) — `https://us-central1-jdk-member-board.cloudfunctions.net/searchBoardGame?q=...`, `.../getBoardGameDetail?id=...`
- Consumes: DOM id `input-game-search`, `game-candidates`, `selected-games` (Task 3)
- Produces: 모듈 스코프 배열 `selectedGames` — 제출 핸들러가 `postData.games`로 사용. `loadForEdit`가 `post.games`로 초기화.

- [ ] **Step 1: 상단에 함수 엔드포인트 상수와 상태 배열 추가**

`assets/js/write.js` 8번째 줄(`const ROOT_UID = ...`) 다음에 추가:

```js
const FUNCTIONS_BASE = "https://us-central1-jdk-member-board.cloudfunctions.net";
let selectedGames = [];
```

- [ ] **Step 2: 게임 태그 렌더링 및 검색/선택 로직 함수 추가**

`write.js`의 `showError` 함수 앞에 추가:

```js
function renderSelectedGames() {
  const el = document.getElementById("selected-games");
  el.innerHTML = selectedGames.map((g, i) => `
    <span class="game-tag">
      ${g.thumbnail ? `<img src="${g.thumbnail}" alt="">` : ""}
      ${escapeGameText(g.name)}${g.yearPublished ? ` (${g.yearPublished})` : ""}
      <button type="button" data-idx="${i}" class="game-tag-remove">×</button>
    </span>
  `).join("");
  el.querySelectorAll(".game-tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedGames.splice(Number(btn.dataset.idx), 1);
      renderSelectedGames();
    });
  });
}

function escapeGameText(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderCandidates(candidates) {
  const el = document.getElementById("game-candidates");
  if (!candidates.length) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.innerHTML = candidates.map((c) =>
    `<div class="game-candidate" data-id="${c.bggId}" data-name="${escapeGameText(c.name)}">
      ${escapeGameText(c.name)}${c.yearPublished ? ` (${c.yearPublished})` : ""}
    </div>`
  ).join("");
  el.style.display = "block";
  el.querySelectorAll(".game-candidate").forEach((row) => {
    row.addEventListener("click", async () => {
      const bggId = row.dataset.id;
      el.style.display = "none";
      document.getElementById("input-game-search").value = "";
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/getBoardGameDetail?id=${encodeURIComponent(bggId)}`);
        const detail = await res.json();
        if (detail) {
          selectedGames.push(detail);
          renderSelectedGames();
        }
      } catch (e) {
        console.error("게임 상세 조회 실패:", e);
      }
    });
  });
}

let searchDebounceTimer = null;
function setupGameSearch() {
  const input = document.getElementById("input-game-search");
  input.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    const q = input.value.trim();
    if (!q) { renderCandidates([]); return; }
    searchDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/searchBoardGame?q=${encodeURIComponent(q)}`);
        renderCandidates(await res.json());
      } catch (e) {
        console.error("게임 검색 실패:", e);
        renderCandidates([]);
      }
    }, 300);
  });
}
```

- [ ] **Step 3: `requireApproved` 콜백에서 `setupGameSearch()` 호출**

`write.js`의 `requireApproved(async (user, userData) => { ... })` 블록에서 `updateEventFields();` 다음 줄에 추가:

```js
  setupGameSearch();
```

- [ ] **Step 4: `loadForEdit`에서 기존 게임 목록 채우기**

`loadForEdit` 함수의 `if (post.type === "event" && post.eventDate)` 블록 안, `document.getElementById("input-max").value = post.maxAttendees || 5;` 다음에 추가:

```js
    selectedGames = post.games || [];
    renderSelectedGames();
```

- [ ] **Step 5: 제출 핸들러에서 `games` 필드 저장**

수정 모드 블록(`if (editId) { ... }`)의 `if (type === "event") { updates.eventDate = eventDate; updates.maxAttendees = ...; }` 부분을 다음으로 교체:

```js
      if (type === "event") {
        updates.eventDate = eventDate;
        updates.maxAttendees = parseInt(document.getElementById("input-max").value, 10);
        updates.games = selectedGames;
      }
```

신규 등록 블록의 `if (type === "event") { postData.eventDate = eventDate; postData.maxAttendees = ...; postData.attendees = [assignedUid]; }` 부분을 다음으로 교체:

```js
      if (type === "event") {
        postData.eventDate = eventDate;
        postData.maxAttendees = parseInt(document.getElementById("input-max").value, 10);
        postData.attendees = [assignedUid];
        postData.games = selectedGames;
      }
```

- [ ] **Step 6: 수동 확인 (Firebase 로컬 환경이 없으므로 코드 리뷰로 대체)**

Run: `cd /Users/daso/jdk && node --check assets/js/write.js`
Expected: 문법 에러 없음(출력 없음, exit code 0)

- [ ] **Step 7: 커밋**

```bash
git add assets/js/write.js
git commit -m "feat: add BGG game search/select logic to write form"
```

---

### Task 5: post.js — 게임 카드 섹션 렌더링

**Files:**
- Modify: `assets/js/post.js`

**Interfaces:**
- Consumes: `postData.games` (Task 4가 저장한 배열: `{ bggId, name, yearPublished, thumbnail }[]`)

- [ ] **Step 1: `escapeHtml` 헬퍼와 게임 카드 HTML을 만드는 헬퍼 추가**

`post.js`의 `formatEventDate` 함수 앞에 추가:

```js
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
```

`formatEventDate` 함수 다음에 추가:

```js
function renderGamesSection(games) {
  if (!games || !games.length) return "";
  const cards = games.map((g) => `
    <a class="game-card" href="https://boardgamegeek.com/boardgame/${g.bggId}" target="_blank" rel="noopener">
      ${g.thumbnail ? `<img src="${g.thumbnail}" alt="${escapeHtml(g.name)}">` : `<div class="game-card-noimg"></div>`}
      <span>${escapeHtml(g.name)}${g.yearPublished ? ` (${g.yearPublished})` : ""}</span>
    </a>
  `).join("");
  return `
    <div class="post-games-section">
      <p class="attendee-section-title">함께 할 게임</p>
      <div class="game-card-list">${cards}</div>
    </div>
  `;
}
```

- [ ] **Step 2: `loadPost`에서 게임 섹션을 post-content 뒤에 삽입**

`post.js`의 `document.getElementById("post-content").innerHTML = ...` 대입문 바로 다음 줄에 추가:

```js
  document.getElementById("post-content").insertAdjacentHTML("afterend", renderGamesSection(postData.games));
```

- [ ] **Step 3: 문법 검증**

Run: `node --check assets/js/post.js`
Expected: 문법 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add assets/js/post.js
git commit -m "feat: render selected BGG games on post detail page"
```

---

### Task 6: CSS — 검색 드롭다운/태그/카드 스타일

**Files:**
- Modify: `assets/css/pages.css`

- [ ] **Step 1: 파일 끝에 스타일 추가**

```css
/* BGG 게임 검색 */
.game-candidates {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--card-shadow);
  max-height: 220px;
  overflow-y: auto;
}
.game-candidate {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-primary);
}
.game-candidate:hover {
  background: var(--accent-light);
}
.selected-games {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.game-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--input-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 0.85rem;
  color: var(--text-primary);
}
.game-tag img {
  width: 24px;
  height: 24px;
  object-fit: cover;
  border-radius: 3px;
}
.game-tag-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}
.post-games-section {
  margin-top: 24px;
}
.game-card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.game-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100px;
  text-decoration: none;
  color: var(--text-primary);
  font-size: 0.78rem;
  text-align: center;
}
.game-card img,
.game-card-noimg {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--card-border);
  background: var(--input-bg);
  margin-bottom: 4px;
}
```

- [ ] **Step 2: 커밋**

```bash
git add assets/css/pages.css
git commit -m "style: add BGG game search dropdown, tag, and card styles"
```

---

### Task 7: 통합 확인

**Files:** 없음 (수동/스크립트 검증만)

- [ ] **Step 1: functions 전체 테스트 재실행**

Run: `cd functions && node --test`
Expected: PASS, 전체 12개 테스트 통과

- [ ] **Step 2: 수정한 JS 파일 전체 문법 검증**

Run: `cd /Users/daso/jdk && node --check assets/js/write.js && node --check assets/js/post.js && echo OK`
Expected: `OK` 출력

- [ ] **Step 3: Functions 배포 (수동 승인 필요 — 배포는 사용자 확인 후 진행)**

Run: `cd functions && firebase deploy --only functions:searchBoardGame,functions:getBoardGameDetail`
Expected: 배포 성공, `https://us-central1-jdk-member-board.cloudfunctions.net/searchBoardGame?q=catan` 호출 시 JSON 배열 응답

- [ ] **Step 4: 브라우저로 실제 플로우 확인**

`/write/`에서 "카탄" 검색 → 후보 목록 표시 → 하나 선택 → 태그로 추가됨 → 일정 등록 → `/post/?id=...`에서 게임 카드(썸네일 포함) 표시 확인.

- [ ] **Step 5: 최종 커밋 (있다면 남은 변경사항)**

```bash
git status
```

Expected: 변경사항 없음 (모든 작업이 이전 태스크에서 커밋됨)
