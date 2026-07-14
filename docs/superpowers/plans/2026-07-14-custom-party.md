# 커스텀 파티(고정 인원) 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유저가 마이페이지에서 "파티"(고정 멤버 그룹)를 만들고, 글쓰기 페이지에서 파티를 선택하면 참석 인원(attendees)과 최대 인원이 자동으로 채워지게 한다.

**Architecture:** 새 Firestore 컬렉션 `parties`를 CRUD하는 순수 로직 모듈(`party-logic.js`)과 Firestore I/O 모듈(`party.js`)을 만들고, 마이페이지에 파티 관리 UI를, 글쓰기 페이지에 파티 선택 드롭다운을 추가한다. 파티와 게시글(posts) 사이에는 참조 관계를 두지 않고, 선택 시점에 멤버 uid를 attendees로 일회성 복사한다.

**Tech Stack:** Firebase Firestore (JS SDK v10, 모듈 CDN import), 순수 ES 모듈(node --test로 단위 테스트), Jekyll 정적 페이지.

## Global Constraints

- Firestore 규칙은 이미 사용자가 콘솔에 반영함 — 규칙 관련 작업 없음, `parties/{partyId}`는 `ownerUid == request.auth.uid`인 경우만 접근 가능하다고 가정하고 클라이언트 코드를 작성한다.
- `parties` 문서 스키마: `{ ownerUid: string, name: string, memberUids: string[], createdAt, updatedAt }`. `memberUids`는 항상 `ownerUid`를 포함한다.
- 파티-게시글 참조 없음. write 폼에서 파티 선택 시 그 순간의 `memberUids`를 `attendees`에 복사만 한다.
- 파티 선택은 신규 등록 시에만 노출, 수정 모드에서는 노출하지 않는다.
- 파티가 없는 유저에게는 관련 UI를 숨긴다(빈 상태 처리).
- 기존 코드 스타일 유지: DOM 의존 없는 순수 로직은 `*-logic.js` + `*-logic.test.mjs`로 분리(`suika-logic.js`, `rating-logic.js` 패턴).

---

### Task 1: party-logic.js — 순수 로직 (멤버 목록 정규화)

**Files:**
- Create: `assets/js/party-logic.js`
- Test: `assets/js/party-logic.test.mjs`

**Interfaces:**
- Consumes: 없음 (순수 함수, 의존성 없음)
- Produces:
  - `normalizeMembers(ownerUid, memberUids)` → `string[]` — ownerUid를 항상 포함하고 중복을 제거한 멤버 목록을 반환. 이후 Task 2(`party.js`)의 `createParty`/`updateParty`가 저장 전에 호출한다.
  - `filterByNickname(users, query)` → `Array<{uid, nickname}>` — `users`(각 원소가 `{uid, nickname}`) 중 `query`가 닉네임에 부분일치(대소문자 무시)하는 항목만 반환. 빈 query면 빈 배열 반환. Task 3에서 유저 검색 필터링에 사용.

- [ ] **Step 1: Write the failing test**

`assets/js/party-logic.test.mjs`:

```js
import assert from "node:assert";
import { test } from "node:test";
import { normalizeMembers, filterByNickname } from "./party-logic.js";

test("normalizeMembers: ownerUid가 없으면 자동으로 추가", () => {
  assert.deepStrictEqual(normalizeMembers("owner1", ["a", "b"]), ["owner1", "a", "b"]);
});

test("normalizeMembers: ownerUid가 이미 있으면 중복 추가하지 않음", () => {
  assert.deepStrictEqual(normalizeMembers("owner1", ["a", "owner1", "b"]), ["a", "owner1", "b"]);
});

test("normalizeMembers: 멤버 중복 제거", () => {
  assert.deepStrictEqual(normalizeMembers("owner1", ["a", "a", "b"]), ["owner1", "a", "b"]);
});

test("normalizeMembers: 빈 배열이면 ownerUid만 남음", () => {
  assert.deepStrictEqual(normalizeMembers("owner1", []), ["owner1"]);
});

test("filterByNickname: 부분일치 대소문자 무시", () => {
  const users = [
    { uid: "1", nickname: "다소" },
    { uid: "2", nickname: "카레" },
    { uid: "3", nickname: "산도깨비" }
  ];
  assert.deepStrictEqual(filterByNickname(users, "다소"), [{ uid: "1", nickname: "다소" }]);
  assert.deepStrictEqual(filterByNickname(users, "도"), [
    { uid: "1", nickname: "다소" },
    { uid: "3", nickname: "산도깨비" }
  ]);
});

test("filterByNickname: 빈 query면 빈 배열", () => {
  const users = [{ uid: "1", nickname: "다소" }];
  assert.deepStrictEqual(filterByNickname(users, ""), []);
  assert.deepStrictEqual(filterByNickname(users, "  "), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test assets/js/party-logic.test.mjs`
Expected: FAIL — `party-logic.js` 모듈이 없어 import 에러(`Cannot find module`).

- [ ] **Step 3: Write minimal implementation**

`assets/js/party-logic.js`:

```js
export function normalizeMembers(ownerUid, memberUids) {
  const unique = [...new Set(memberUids)];
  if (!unique.includes(ownerUid)) unique.unshift(ownerUid);
  return unique;
}

export function filterByNickname(users, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return users.filter((u) => u.nickname.toLowerCase().includes(q));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test assets/js/party-logic.test.mjs`
Expected: PASS — 7개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add assets/js/party-logic.js assets/js/party-logic.test.mjs
git commit -m "feat: add party-logic pure functions for member normalization and search"
```

---

### Task 2: party.js — Firestore CRUD 모듈

**Files:**
- Create: `assets/js/party.js`

**Interfaces:**
- Consumes:
  - `normalizeMembers(ownerUid, memberUids)` from `./party-logic.js` (Task 1)
  - `db` from `./firebase-init.js`
  - Firestore SDK: `collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp` from `https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js`
- Produces (사용처: Task 3 mypage.js, Task 4 write.js):
  - `listMyParties(ownerUid)` → `Promise<Array<{id, name, memberUids}>>`
  - `createParty(ownerUid, name, memberUids)` → `Promise<string>` (생성된 partyId 반환)
  - `updateParty(partyId, ownerUid, name, memberUids)` → `Promise<void>`
  - `deleteParty(partyId)` → `Promise<void>`
  - `listApprovedUsers()` → `Promise<Array<{uid, nickname}>>` (status == "approved" 유저 전체, 닉네임 검색용 후보 목록)

이 파일은 DOM에 의존하지 않는다(Firestore I/O만). Task 1의 `normalizeMembers`로 저장 전 멤버 목록을 정규화한다.

- [ ] **Step 1: Write the implementation**

`assets/js/party.js`:

```js
import { db } from "./firebase-init.js";
import { normalizeMembers } from "./party-logic.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function listMyParties(ownerUid) {
  const snap = await getDocs(query(collection(db, "parties"), where("ownerUid", "==", ownerUid)));
  return snap.docs.map((d) => ({ id: d.id, name: d.data().name, memberUids: d.data().memberUids || [] }));
}

export async function createParty(ownerUid, name, memberUids) {
  const ref = await addDoc(collection(db, "parties"), {
    ownerUid,
    name,
    memberUids: normalizeMembers(ownerUid, memberUids),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateParty(partyId, ownerUid, name, memberUids) {
  await updateDoc(doc(db, "parties", partyId), {
    name,
    memberUids: normalizeMembers(ownerUid, memberUids),
    updatedAt: serverTimestamp()
  });
}

export async function deleteParty(partyId) {
  await deleteDoc(doc(db, "parties", partyId));
}

export async function listApprovedUsers() {
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
  return snap.docs.map((d) => ({ uid: d.id, nickname: d.data().nickname || d.id }));
}
```

`updateParty`가 `ownerUid`를 인자로 받는 이유: `normalizeMembers`가 owner를 항상 포함시켜야 하는데, 문서 자체엔 이미 `ownerUid` 필드가 있지만 갱신 전 별도 조회 없이 호출자가 이미 알고 있는 값을 넘기는 편이 왕복 조회 하나를 줄인다.

- [ ] **Step 2: 문법 확인 (구문 오류 없는지)**

Run: `node --check assets/js/party.js`
Expected: 출력 없음(성공) — `--check`는 문법만 검사하고 import 해석은 하지 않으므로 브라우저 전용 CDN import가 있어도 통과한다.

- [ ] **Step 3: Commit**

```bash
git add assets/js/party.js
git commit -m "feat: add party.js Firestore CRUD module"
```

---

### Task 3: 마이페이지 — 내 파티 관리 UI

**Files:**
- Modify: `mypage.html:54-56` (탈퇴 섹션 앞 `<hr>` 앞에 새 섹션 삽입)
- Modify: `assets/js/mypage.js`
- Modify: `assets/css/pages.css` (파티 폼용 최소 스타일 추가, 기존 `.game-tag`/`.game-candidates`류 재사용)

**Interfaces:**
- Consumes:
  - `listMyParties, createParty, updateParty, deleteParty, listApprovedUsers` from `./party.js` (Task 2)
  - `filterByNickname` from `./party-logic.js` (Task 1)
  - 기존 `mypage.js`의 `currentUser`, `requireApproved` 콜백 구조

**HTML 변경 (`mypage.html`):** 55번째 줄의 `<hr style="margin:24px 0">` 앞에 아래 블록을 삽입한다.

```html
      <div id="section-parties" class="mb-4">
        <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:4px">내 파티</div>
        <div id="party-list"></div>
        <button type="button" id="btn-party-new" style="margin-top:8px;border:1px solid var(--card-border);background:var(--input-bg);color:var(--text-primary);border-radius:6px;padding:7px 16px;cursor:pointer;font-size:0.85rem">+ 새 파티 만들기</button>

        <div id="party-form" style="display:none;margin-top:12px;border:1px solid var(--card-border);border-radius:8px;padding:14px">
          <input type="hidden" id="party-form-id">
          <div class="mb-3">
            <label class="form-label">파티 이름</label>
            <input type="text" id="party-form-name" class="form-control" placeholder="예: 프로스트헤이븐 파티">
          </div>
          <div class="mb-3">
            <label class="form-label">멤버</label>
            <div style="position:relative">
              <input type="text" id="party-member-search" class="form-control" placeholder="닉네임 검색" autocomplete="off">
              <div id="party-member-candidates" class="game-candidates" style="display:none"></div>
            </div>
            <div id="party-member-list" class="selected-games"></div>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" id="btn-party-save" style="border:none;background:var(--accent);color:#fff;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:0.85rem;font-weight:600">저장</button>
            <button type="button" id="btn-party-cancel" style="border:1px solid var(--card-border);background:transparent;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:0.85rem">취소</button>
          </div>
        </div>
      </div>

```

**JS 변경 (`mypage.js`):** 파일 상단 import에 party 모듈 추가, `requireApproved` 콜백 안(`document.getElementById("btn-withdraw")...` 블록 앞)에 `setupParties(user, userData)` 호출을 추가하고, 파일 하단에 아래 함수들을 추가한다.

```js
import { listMyParties, createParty, updateParty, deleteParty, listApprovedUsers } from "./party.js";
import { filterByNickname } from "./party-logic.js";
```

`requireApproved(async (user, userData) => { ... })` 콜백 안, 기존 `document.getElementById("btn-withdraw").addEventListener(...)` 줄 바로 앞에 추가:

```js
  await setupParties(user);
```

파일 끝에 추가:

```js
let allApprovedUsers = [];
let partyDraftMembers = []; // {uid, nickname}[], 편집 중인 파티의 멤버(본인 제외 표시용, 본인은 항상 포함됨을 별도 안내)
let editingPartyId = null;

async function setupParties(user) {
  allApprovedUsers = await listApprovedUsers().catch((e) => {
    console.error("승인된 유저 목록 조회 실패", e);
    return [];
  });

  await renderPartyList(user);

  document.getElementById("btn-party-new").addEventListener("click", () => openPartyForm(user, null));
  document.getElementById("btn-party-cancel").addEventListener("click", closePartyForm);
  document.getElementById("btn-party-save").addEventListener("click", () => savePartyForm(user));

  const searchInput = document.getElementById("party-member-search");
  searchInput.addEventListener("input", () => {
    const matches = filterByNickname(
      allApprovedUsers.filter((u) => u.uid !== user.uid && !partyDraftMembers.some((m) => m.uid === u.uid)),
      searchInput.value
    );
    renderPartyMemberCandidates(matches, user);
  });
}

async function renderPartyList(user) {
  const listEl = document.getElementById("party-list");
  let parties = [];
  try {
    parties = await listMyParties(user.uid);
  } catch (e) {
    console.error("파티 목록 조회 실패", e);
    listEl.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted)">파티 목록을 불러오지 못했습니다.</div>`;
    return;
  }

  if (!parties.length) {
    listEl.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted)">아직 만든 파티가 없습니다.</div>`;
    return;
  }

  listEl.innerHTML = parties.map((p) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--card-border)" data-party-id="${escapePartyText(p.id)}">
      <div>
        <div style="font-weight:600;font-size:0.9rem">${escapePartyText(p.name)}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${p.memberUids.map((uid) => escapePartyText(nicknameOf(uid))).join(", ")}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button type="button" class="party-edit-btn" data-id="${escapePartyText(p.id)}" style="border:1px solid var(--card-border);background:transparent;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:0.8rem">수정</button>
        <button type="button" class="party-delete-btn" data-id="${escapePartyText(p.id)}" style="border:1px solid var(--danger);color:var(--danger);background:transparent;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:0.8rem">삭제</button>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".party-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const party = parties.find((p) => p.id === btn.dataset.id);
      openPartyForm(user, party);
    });
  });
  listEl.querySelectorAll(".party-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteParty(btn.dataset.id);
      await renderPartyList(user);
    });
  });
}

function nicknameOf(uid) {
  return allApprovedUsers.find((u) => u.uid === uid)?.nickname || uid;
}

function openPartyForm(user, party) {
  editingPartyId = party ? party.id : null;
  document.getElementById("party-form-id").value = editingPartyId || "";
  document.getElementById("party-form-name").value = party ? party.name : "";
  partyDraftMembers = party
    ? party.memberUids.filter((uid) => uid !== user.uid).map((uid) => ({ uid, nickname: nicknameOf(uid) }))
    : [];
  document.getElementById("party-member-search").value = "";
  renderPartyMemberCandidates([], user);
  renderPartyDraftMembers(user);
  document.getElementById("party-form").style.display = "block";
}

function closePartyForm() {
  document.getElementById("party-form").style.display = "none";
  editingPartyId = null;
  partyDraftMembers = [];
}

function renderPartyMemberCandidates(matches, user) {
  const el = document.getElementById("party-member-candidates");
  if (!matches.length) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.innerHTML = matches.map((u) =>
    `<div class="game-candidate" data-uid="${escapePartyText(u.uid)}">${escapePartyText(u.nickname)}</div>`
  ).join("");
  el.style.display = "block";
  el.querySelectorAll(".game-candidate").forEach((row) => {
    row.addEventListener("click", () => {
      const uid = row.dataset.uid;
      const u = allApprovedUsers.find((x) => x.uid === uid);
      partyDraftMembers.push(u);
      document.getElementById("party-member-search").value = "";
      renderPartyMemberCandidates([], user);
      renderPartyDraftMembers(user);
    });
  });
}

function renderPartyDraftMembers(user) {
  const el = document.getElementById("party-member-list");
  const ownerChip = `<span class="game-tag">${escapePartyText(nicknameOf(user.uid))} (본인)</span>`;
  const memberChips = partyDraftMembers.map((m, i) => `
    <span class="game-tag">
      ${escapePartyText(m.nickname)}
      <button type="button" data-idx="${i}" class="game-tag-remove">×</button>
    </span>
  `).join("");
  el.innerHTML = ownerChip + memberChips;
  el.querySelectorAll(".game-tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      partyDraftMembers.splice(Number(btn.dataset.idx), 1);
      renderPartyDraftMembers(user);
    });
  });
}

async function savePartyForm(user) {
  const name = document.getElementById("party-form-name").value.trim();
  const memberUids = partyDraftMembers.map((m) => m.uid);
  try {
    if (editingPartyId) {
      await updateParty(editingPartyId, user.uid, name, memberUids);
    } else {
      await createParty(user.uid, name, memberUids);
    }
    closePartyForm();
    await renderPartyList(user);
  } catch (e) {
    console.error("파티 저장 실패", e);
    showError("파티 저장 중 오류가 발생했습니다.");
  }
}

function escapePartyText(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML.replace(/"/g, "&quot;");
}
```

`showError`는 `mypage.js`에 이미 정의되어 있으므로(파일 하단 `function showError(msg) {...}`) 재사용한다.

- [ ] **Step 1: 문법 확인**

Run: `node --check assets/js/mypage.js`
Expected: 출력 없음(성공)

- [ ] **Step 2: 브라우저 수동 확인**

로컬에서 Jekyll 서버를 띄우고(`bundle exec jekyll serve` 또는 기존 프로젝트 실행 방식) `/mypage/`에 로그인 상태로 접속해:
1. "내 파티" 섹션이 보이는지, 파티가 없으면 "아직 만든 파티가 없습니다" 문구가 보이는지 확인
2. "+ 새 파티 만들기" 클릭 → 폼이 열리고 본인 chip이 "(본인)"으로 항상 표시되는지 확인
3. 닉네임 검색 → 후보 클릭 → chip으로 추가되는지, ×로 제거되는지 확인
4. 저장 → 목록에 새 파티가 나타나는지 확인
5. 수정 클릭 → 기존 이름/멤버가 채워진 폼이 열리는지 확인, 수정 후 저장 → 목록 갱신 확인
6. 삭제 클릭 → 즉시 목록에서 사라지는지 확인

Expected: 위 6단계 모두 에러 없이 동작.

- [ ] **Step 3: Commit**

```bash
git add mypage.html assets/js/mypage.js
git commit -m "feat: add party management UI to mypage"
```

---

### Task 4: 글쓰기 페이지 — 파티 선택 드롭다운

**Files:**
- Modify: `write.html:76-79` ("최대 참석 인원" 필드 앞에 드롭다운 삽입)
- Modify: `assets/js/write.js`

**Interfaces:**
- Consumes:
  - `listMyParties` from `./party.js` (Task 2)
  - `normalizeMembers` from `./party-logic.js` (Task 1)
  - 기존 `write.js`의 `requireApproved` 콜백, `document.getElementById("input-max")`, `attendees` 제출 로직(102번째 줄 `form-write` submit 핸들러)

**HTML 변경 (`write.html`):** 76번째 줄(`<div class="mb-3">` — 최대 참석 인원 블록) 바로 앞에 삽입.

```html
        <div id="section-party" class="mb-3" style="display:none">
          <label class="form-label">내 파티 불러오기</label>
          <select id="select-party" class="form-select">
            <option value="">선택 안 함</option>
          </select>
        </div>
```

**JS 변경 (`write.js`):**

Import에 `listMyParties` 추가:

```js
import { listMyParties } from "./party.js";
import { normalizeMembers } from "./party-logic.js";
```

`requireApproved(async (user, userData) => { ... })` 콜백 안, `setupGameSearch();` 줄 다음에 추가 (editId가 없을 때, 즉 신규 등록일 때만 노출):

```js
  if (!editId) {
    await setupPartySelect(user);
  }
```

파일 하단(`showError` 함수 앞)에 추가:

```js
let myParties = [];

async function setupPartySelect(user) {
  try {
    myParties = await listMyParties(user.uid);
  } catch (e) {
    console.error("파티 목록 조회 실패", e);
    return;
  }
  if (!myParties.length) return;

  const select = document.getElementById("select-party");
  myParties.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.memberUids.length}명)`;
    select.appendChild(opt);
  });
  document.getElementById("section-party").style.display = "block";

  select.addEventListener("change", () => {
    const party = myParties.find((p) => p.id === select.value);
    if (!party) return;
    selectedPartyAttendees = party.memberUids;
    document.getElementById("input-max").value = party.memberUids.length;
  });
}
```

파일 상단 `let selectedGames = [];` 아래에 상태 변수 추가:

```js
let selectedPartyAttendees = null;
```

제출 핸들러(102번째 줄) 안, 신규 등록 분기(135번째 줄 `// 신규 등록` 주석 아래) 에서 `postData.attendees = [assignedUid];`를 아래로 교체:

```js
        postData.attendees = selectedPartyAttendees
          ? normalizeMembers(assignedUid, selectedPartyAttendees)
          : [assignedUid];
```

`normalizeMembers`(Task 1)를 재사용해 "파티를 선택하지 않았으면 작성자 1인", "파티를 선택했으면 파티 멤버 목록에 작성자가 반드시 포함되도록" 보장한다 — 어드민이 다른 사람을 작성자로 지정해 `assignedUid`가 파티 멤버에 없는 경우까지 함수 하나로 처리된다.

- [ ] **Step 1: 문법 확인**

Run: `node --check assets/js/write.js`
Expected: 출력 없음(성공)

- [ ] **Step 2: 브라우저 수동 확인**

`/write/`에 로그인 상태로 접속해(사전에 Task 3에서 파티를 최소 1개 만들어 둔 상태로):
1. "내 파티 불러오기" 드롭다운이 보이는지 확인 (파티가 없는 계정으로 보면 드롭다운 자체가 안 보이는지도 확인)
2. 파티 선택 → "최대 참석 인원" 값이 파티 멤버 수로 자동 변경되는지 확인
3. 최대 인원을 수동으로 더 늘려본 뒤 제출 → 게시글 상세에서 참석자 수가 파티 멤버 수만큼 채워졌는지 확인
4. 기존 게시글 수정(`/write/?edit=...`) 진입 시 파티 드롭다운이 보이지 않는지 확인

Expected: 위 4단계 모두 정상 동작.

- [ ] **Step 3: Commit**

```bash
git add write.html assets/js/write.js
git commit -m "feat: add party selection to write page for auto-filling attendees"
```

---

## Self-Review 결과

- **스펙 커버리지:** 데이터 모델(Task 2), Firestore 규칙(사용자 완료, Global Constraints에 명시), 컴포넌트 구성(Task 1+2), 마이페이지 UI(Task 3), 글쓰기 페이지 변경(Task 4), 정원 자동 조정(Task 4), 수정 모드 미노출(Task 4), 에러 처리(Task 3/4 각 try/catch), 순수 함수 테스트(Task 1) 모두 태스크로 매핑됨.
- **플레이스홀더 스캔:** 없음 — 모든 단계에 실행 가능한 전체 코드 포함.
- **타입/시그니처 일관성:** `party.js`의 `listMyParties`가 반환하는 `{id, name, memberUids}` 형태를 Task 3(`renderPartyList`)과 Task 4(`setupPartySelect`) 양쪽에서 동일하게 사용. `updateParty(partyId, ownerUid, name, memberUids)` 시그니처를 Task 3의 `savePartyForm`에서 그대로 호출.
