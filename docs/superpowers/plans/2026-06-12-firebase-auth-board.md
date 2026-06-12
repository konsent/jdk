# Firebase 회원제 + 일정 게시판 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장단콩 클럽 Jekyll 사이트에 Firebase 기반 회원제 로그인, 운영자 승인 시스템, 일정 게시판(캘린더 뷰), 공지 게시판을 추가한다.

**Architecture:** Firebase Authentication(Google OAuth + 이메일/비밀번호)으로 로그인을 처리하고, Firestore에 users/posts/comments 컬렉션을 두어 데이터를 관리한다. Jekyll 정적 페이지에 Firebase SDK를 ES Module 방식으로 로드하고, 각 페이지별 JS 파일이 UI와 Firebase를 연결한다. 보안은 Firestore Security Rules로 강제한다.

**Tech Stack:** Jekyll (GitHub Pages), Firebase Authentication, Cloud Firestore, FullCalendar v6 (CDN), Vanilla JS (ES Modules), Bootstrap 5 (기존 사용 중)

---

## 파일 구조

### 신규 생성
```
assets/js/firebase-init.js       ← Firebase 초기화 및 export (auth, db)
assets/js/auth-guard.js          ← 로그인/승인 상태 확인 공통 유틸
assets/js/login.js               ← /login.html 전용
assets/js/register.js            ← /register.html 전용
assets/js/board.js               ← /board.html 전용 (캘린더 + 목록)
assets/js/post.js                ← /post.html 전용 (상세 + 참석 + 댓글)
assets/js/write.js               ← /write.html 전용
assets/js/admin.js               ← /admin.html 전용

login.html                       ← 로그인 페이지
register.html                    ← 닉네임 입력 + 가입 신청
board.html                       ← 게시판 메인 (공지 + 일정 캘린더/목록)
post.html                        ← 일정/공지 상세
write.html                       ← 글 작성
admin.html                       ← 운영자 관리 페이지

assets/css/board.css             ← 게시판 공통 스타일
```

### 수정
```
_includes/header.html            ← 네비게이션에 게시판/로그인 링크 추가
_config.yml                      ← navigation에 게시판 항목 추가
```

---

## Task 1: Firebase 프로젝트 세팅 (수동 작업)

이 태스크는 Firebase 콘솔에서 직접 수행한다. 코드 작업이 없다.

- [ ] **Step 1: Firebase 프로젝트 생성**

  1. [console.firebase.google.com](https://console.firebase.google.com) 접속
  2. "프로젝트 추가" 클릭 → 프로젝트 이름: `jdk-club` → 생성
  3. Google Analytics는 선택사항 (껴도 무방)

- [ ] **Step 2: Authentication 활성화**

  1. 좌측 메뉴 "빌드" → "Authentication" → "시작하기"
  2. "Sign-in method" 탭 → **Google** 활성화 (프로젝트 지원 이메일 입력)
  3. **이메일/비밀번호** 활성화 (이메일 링크는 비활성)

- [ ] **Step 3: Firestore Database 생성**

  1. 좌측 메뉴 "빌드" → "Firestore Database" → "데이터베이스 만들기"
  2. 위치: `asia-northeast3` (서울)
  3. 시작 모드: **테스트 모드** (30일 후 규칙 적용 — Task 2에서 바꿈)

- [ ] **Step 4: 웹 앱 등록 및 config 복사**

  1. 프로젝트 홈 → 웹 아이콘(`</>`) 클릭
  2. 앱 닉네임: `jdk-web` → "앱 등록"
  3. 표시되는 `firebaseConfig` 객체를 텍스트 파일에 복사해 두기 (다음 태스크에서 사용)

  ```js
  // 이런 형태로 복사됨
  const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "jdk-club.firebaseapp.com",
    projectId: "jdk-club",
    storageBucket: "jdk-club.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
  };
  ```

- [ ] **Step 5: GitHub Pages 도메인을 Firebase Auth 허용 도메인에 추가**

  1. Authentication → "Settings" 탭 → "승인된 도메인"
  2. "도메인 추가" → `konsent.github.io` 입력 후 추가

---

## Task 2: Firebase 초기화 및 보안 규칙

**Files:**
- Create: `assets/js/firebase-init.js`
- Firestore 보안 규칙 (콘솔에서 직접 입력)

- [ ] **Step 1: firebase-init.js 생성**

  Task 1 Step 4에서 복사한 firebaseConfig 값을 아래에 채워 넣는다.

  ```js
  // assets/js/firebase-init.js
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "여기에_복사한_값",
    authDomain: "여기에_복사한_값",
    projectId: "여기에_복사한_값",
    storageBucket: "여기에_복사한_값",
    messagingSenderId: "여기에_복사한_값",
    appId: "여기에_복사한_값"
  };

  const app = initializeApp(firebaseConfig);
  export const auth = getAuth(app);
  export const db = getFirestore(app);
  ```

- [ ] **Step 2: Firestore 보안 규칙 적용**

  Firebase 콘솔 → Firestore → "규칙" 탭 → 아래 내용으로 교체 후 "게시":

  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {

      function isApproved() {
        return request.auth != null &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.status == "approved";
      }

      function isAdmin() {
        return request.auth != null &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
      }

      match /users/{uid} {
        allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
        allow create: if request.auth != null && request.auth.uid == uid;
        allow update: if isAdmin();
      }

      match /posts/{postId} {
        allow read: if isApproved();
        allow create: if isApproved();
        allow update: if isAdmin()
          || request.auth.uid == resource.data.authorUid
          || isApproved();
        allow delete: if isAdmin() || request.auth.uid == resource.data.authorUid;
      }

      match /comments/{commentId} {
        allow read: if isApproved();
        allow create: if isApproved();
        allow delete: if isAdmin() || request.auth.uid == resource.data.authorUid;
      }
    }
  }
  ```

- [ ] **Step 3: auth-guard.js 생성**

  ```js
  // assets/js/auth-guard.js
  import { auth, db } from "./firebase-init.js";
  import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  export async function getUserDoc(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  }

  // 로그인 + approved 상태가 아니면 /login.html로 리다이렉트
  export function requireApproved(callback) {
    onAuthStateChanged(auth, async (user) => {
      if (!user) { location.href = "/login.html"; return; }
      const data = await getUserDoc(user.uid);
      if (!data || data.status !== "approved") { location.href = "/login.html"; return; }
      callback(user, data);
    });
  }

  // 로그인 + isAdmin이 아니면 /board.html로 리다이렉트
  export function requireAdmin(callback) {
    onAuthStateChanged(auth, async (user) => {
      if (!user) { location.href = "/login.html"; return; }
      const data = await getUserDoc(user.uid);
      if (!data || !data.isAdmin) { location.href = "/board.html"; return; }
      callback(user, data);
    });
  }
  ```

- [ ] **Step 4: 커밋**

  ```bash
  git add assets/js/firebase-init.js assets/js/auth-guard.js
  git commit -m "feat: add Firebase init and auth guard"
  ```

---

## Task 3: 로그인 페이지 (`/login.html`)

**Files:**
- Create: `login.html`
- Create: `assets/js/login.js`

- [ ] **Step 1: login.html 생성**

  ```html
  ---
  layout: default
  title: 로그인
  ---
  <div class="row justify-content-center mt-5">
    <div class="col-md-5">
      <h2 class="mb-4">로그인</h2>

      <button id="btn-google" class="btn btn-outline-dark w-100 mb-3">
        Google 계정으로 로그인
      </button>

      <hr>

      <form id="form-email" novalidate>
        <div class="mb-3">
          <label class="form-label">이메일</label>
          <input type="email" id="input-email" class="form-control" required>
        </div>
        <div class="mb-3">
          <label class="form-label">비밀번호</label>
          <input type="password" id="input-password" class="form-control" required>
        </div>
        <button type="submit" class="btn btn-primary w-100">이메일로 로그인</button>
      </form>

      <p id="msg-error" class="text-danger mt-3" style="display:none"></p>
      <p id="msg-pending" class="text-warning mt-3" style="display:none">승인 대기 중입니다. 운영자 승인 후 이용 가능합니다.</p>
      <p id="msg-rejected" class="text-danger mt-3" style="display:none">가입이 거절되었습니다. 운영자에게 문의하세요.</p>
    </div>
  </div>

  <script type="module" src="/assets/js/login.js"></script>
  ```

- [ ] **Step 2: login.js 생성**

  ```js
  // assets/js/login.js
  import { auth, db } from "./firebase-init.js";
  import {
    GoogleAuthProvider, signInWithPopup,
    signInWithEmailAndPassword, onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  async function redirectByStatus(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) { location.href = "/register.html"; return; }
    const { status } = snap.data();
    if (status === "approved") { location.href = "/board.html"; return; }
    document.getElementById("msg-pending").style.display = status === "pending" ? "block" : "none";
    document.getElementById("msg-rejected").style.display = status === "rejected" ? "block" : "none";
  }

  onAuthStateChanged(auth, (user) => {
    if (user) redirectByStatus(user.uid);
  });

  document.getElementById("btn-google").addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await redirectByStatus(result.user.uid);
    } catch (e) {
      showError(e.message);
    }
  });

  document.getElementById("form-email").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("input-email").value;
    const password = document.getElementById("input-password").value;
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await redirectByStatus(result.user.uid);
    } catch (e) {
      showError("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
  });

  function showError(msg) {
    const el = document.getElementById("msg-error");
    el.textContent = msg;
    el.style.display = "block";
  }
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add login.html assets/js/login.js
  git commit -m "feat: add login page with Google and email auth"
  ```

---

## Task 4: 회원가입 신청 페이지 (`/register.html`)

**Files:**
- Create: `register.html`
- Create: `assets/js/register.js`

- [ ] **Step 1: register.html 생성**

  ```html
  ---
  layout: default
  title: 회원가입 신청
  ---
  <div class="row justify-content-center mt-5">
    <div class="col-md-5">
      <h2 class="mb-4">회원가입 신청</h2>
      <p class="text-muted">닉네임을 입력하면 운영자 승인 후 이용 가능합니다.</p>

      <div id="section-google-done" style="display:none">
        <p>Google 계정으로 로그인됐습니다.</p>
      </div>

      <form id="form-register" novalidate>
        <div id="section-email-fields">
          <div class="mb-3">
            <label class="form-label">이메일 <span class="text-muted">(이메일 가입 시)</span></label>
            <input type="email" id="input-email" class="form-control">
          </div>
          <div class="mb-3">
            <label class="form-label">비밀번호</label>
            <input type="password" id="input-password" class="form-control">
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">닉네임 <span class="text-danger">*</span></label>
          <input type="text" id="input-nickname" class="form-control" maxlength="12" required>
          <div class="form-text">최대 12자, 게시판에 표시됩니다.</div>
        </div>

        <button type="submit" class="btn btn-primary w-100">가입 신청</button>
      </form>

      <p id="msg-error" class="text-danger mt-3" style="display:none"></p>
      <div id="msg-success" style="display:none">
        <div class="alert alert-success mt-3">
          가입 신청이 완료되었습니다. 운영자 승인 후 이용 가능합니다.
        </div>
      </div>
    </div>
  </div>

  <script type="module" src="/assets/js/register.js"></script>
  ```

- [ ] **Step 2: register.js 생성**

  ```js
  // assets/js/register.js
  import { auth, db } from "./firebase-init.js";
  import {
    onAuthStateChanged, createUserWithEmailAndPassword
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import {
    doc, setDoc, collection, query, where, getDocs, serverTimestamp
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  let currentUser = null;

  onAuthStateChanged(auth, (user) => {
    if (!user) { location.href = "/login.html"; return; }
    currentUser = user;
    if (user.providerData[0]?.providerId === "google.com") {
      document.getElementById("section-email-fields").style.display = "none";
      document.getElementById("section-google-done").style.display = "block";
    }
  });

  document.getElementById("form-register").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nickname = document.getElementById("input-nickname").value.trim();
    if (!nickname) { showError("닉네임을 입력해주세요."); return; }

    // 닉네임 중복 확인
    const q = query(collection(db, "users"), where("nickname", "==", nickname));
    const snap = await getDocs(q);
    if (!snap.empty) { showError("이미 사용 중인 닉네임입니다."); return; }

    try {
      let user = currentUser;

      // 이메일 가입인 경우 계정 생성
      if (user.providerData[0]?.providerId !== "google.com") {
        const email = document.getElementById("input-email").value;
        const password = document.getElementById("input-password").value;
        if (!email || !password) { showError("이메일과 비밀번호를 입력해주세요."); return; }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
      }

      await setDoc(doc(db, "users", user.uid), {
        status: "pending",
        nickname,
        displayName: user.displayName || "",
        email: user.email || "",
        isAdmin: false,
        createdAt: serverTimestamp()
      });

      document.getElementById("form-register").style.display = "none";
      document.getElementById("msg-success").style.display = "block";
    } catch (err) {
      showError(err.message);
    }
  });

  function showError(msg) {
    const el = document.getElementById("msg-error");
    el.textContent = msg;
    el.style.display = "block";
  }
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add register.html assets/js/register.js
  git commit -m "feat: add register page with nickname input and pending status"
  ```

---

## Task 5: 운영자 관리 페이지 (`/admin.html`)

**Files:**
- Create: `admin.html`
- Create: `assets/js/admin.js`

- [ ] **Step 1: admin.html 생성**

  ```html
  ---
  layout: default
  title: 운영자 관리
  ---
  <div class="mt-4">
    <h2>운영자 관리</h2>
    <ul class="nav nav-tabs mb-4" id="admin-tabs">
      <li class="nav-item">
        <button class="nav-link active" data-tab="pending">승인 대기</button>
      </li>
      <li class="nav-item">
        <button class="nav-link" data-tab="members">전체 회원</button>
      </li>
    </ul>

    <div id="tab-pending">
      <h5>승인 대기 목록</h5>
      <div id="list-pending" class="mt-3">불러오는 중...</div>
    </div>

    <div id="tab-members" style="display:none">
      <h5>전체 회원</h5>
      <div id="list-members" class="mt-3">불러오는 중...</div>
    </div>
  </div>

  <script type="module" src="/assets/js/admin.js"></script>
  ```

- [ ] **Step 2: admin.js 생성**

  ```js
  // assets/js/admin.js
  import { db } from "./firebase-init.js";
  import { requireAdmin } from "./auth-guard.js";
  import {
    collection, query, where, getDocs,
    doc, updateDoc
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  requireAdmin(async () => {
    await loadPending();
    await loadMembers();
    setupTabs();
  });

  async function loadPending() {
    const q = query(collection(db, "users"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    const el = document.getElementById("list-pending");
    if (snap.empty) { el.innerHTML = "<p class='text-muted'>대기 중인 신청이 없습니다.</p>"; return; }

    el.innerHTML = snap.docs.map(d => {
      const u = d.data();
      return `
        <div class="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center">
          <div>
            <strong>${u.nickname}</strong>
            <span class="text-muted ms-2">${u.displayName}</span>
            <span class="text-muted ms-2">${u.email}</span>
          </div>
          <div>
            <button class="btn btn-sm btn-success me-1" onclick="setStatus('${d.id}','approved')">승인</button>
            <button class="btn btn-sm btn-danger" onclick="setStatus('${d.id}','rejected')">거절</button>
          </div>
        </div>`;
    }).join("");
  }

  async function loadMembers() {
    const q = query(collection(db, "users"), where("status", "==", "approved"));
    const snap = await getDocs(q);
    const el = document.getElementById("list-members");
    if (snap.empty) { el.innerHTML = "<p class='text-muted'>승인된 회원이 없습니다.</p>"; return; }

    el.innerHTML = snap.docs.map(d => {
      const u = d.data();
      return `
        <div class="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center">
          <div>
            <strong>${u.nickname}</strong>
            <span class="text-muted ms-2">${u.email}</span>
          </div>
          <button class="btn btn-sm btn-outline-danger" onclick="setStatus('${d.id}','rejected')">강제 탈퇴</button>
        </div>`;
    }).join("");
  }

  window.setStatus = async (uid, status) => {
    await updateDoc(doc(db, "users", uid), { status });
    await loadPending();
    await loadMembers();
  };

  function setupTabs() {
    document.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("tab-pending").style.display = btn.dataset.tab === "pending" ? "block" : "none";
        document.getElementById("tab-members").style.display = btn.dataset.tab === "members" ? "block" : "none";
      });
    });
  }
  ```

- [ ] **Step 3: 운영자 계정 초기 설정 (수동)**

  Firebase 콘솔 → Firestore → `users` 컬렉션 → 본인 uid 문서 선택 → 필드 수동 수정:
  - `status`: `"approved"`
  - `isAdmin`: `true`

- [ ] **Step 4: 커밋**

  ```bash
  git add admin.html assets/js/admin.js
  git commit -m "feat: add admin page for member approval"
  ```

---

## Task 6: 글 작성 페이지 (`/write.html`)

**Files:**
- Create: `write.html`
- Create: `assets/js/write.js`

- [ ] **Step 1: write.html 생성**

  ```html
  ---
  layout: default
  title: 글 작성
  ---
  <div class="row justify-content-center mt-4">
    <div class="col-md-8">
      <h2 class="mb-4">글 작성</h2>

      <form id="form-write" novalidate>
        <div id="section-type" class="mb-3" style="display:none">
          <label class="form-label">글 유형</label>
          <select id="select-type" class="form-select">
            <option value="event">일정</option>
            <option value="notice">공지</option>
          </select>
        </div>

        <div class="mb-3">
          <label class="form-label">제목 <span class="text-danger">*</span></label>
          <input type="text" id="input-title" class="form-control" required>
        </div>

        <div id="section-event-fields" class="mb-3">
          <div class="mb-3">
            <label class="form-label">일정 날짜 <span class="text-danger">*</span></label>
            <input type="date" id="input-date" class="form-control" required>
          </div>
          <div class="mb-3">
            <label class="form-label">최대 참석 인원 (본인 포함) <span class="text-danger">*</span></label>
            <input type="number" id="input-max" class="form-control" min="1" max="20" value="5" required>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">내용 <span class="text-danger">*</span></label>
          <textarea id="input-content" class="form-control" rows="8" required></textarea>
        </div>

        <button type="submit" class="btn btn-primary">등록</button>
        <a href="/board.html" class="btn btn-outline-secondary ms-2">취소</a>
      </form>

      <p id="msg-error" class="text-danger mt-3" style="display:none"></p>
    </div>
  </div>

  <script type="module" src="/assets/js/write.js"></script>
  ```

- [ ] **Step 2: write.js 생성**

  ```js
  // assets/js/write.js
  import { db } from "./firebase-init.js";
  import { requireApproved } from "./auth-guard.js";
  import {
    collection, addDoc, serverTimestamp, Timestamp
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  let currentUser = null;
  let currentUserData = null;

  requireApproved((user, userData) => {
    currentUser = user;
    currentUserData = userData;

    if (userData.isAdmin) {
      document.getElementById("section-type").style.display = "block";
    }

    function updateEventFields() {
      const type = document.getElementById("select-type").value;
      document.getElementById("section-event-fields").style.display =
        type === "event" ? "block" : "none";
    }

    document.getElementById("select-type").addEventListener("change", updateEventFields);
    updateEventFields(); // 초기 렌더 시 공지 선택이면 event 필드 숨기기
  });

  document.getElementById("form-write").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("input-title").value.trim();
    const content = document.getElementById("input-content").value.trim();
    const type = currentUserData?.isAdmin
      ? document.getElementById("select-type").value
      : "event";

    if (!title || !content) { showError("제목과 내용을 입력해주세요."); return; }

    const postData = {
      type, title, content,
      authorUid: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (type === "event") {
      const dateStr = document.getElementById("input-date").value;
      const maxAttendees = parseInt(document.getElementById("input-max").value, 10);
      if (!dateStr) { showError("일정 날짜를 선택해주세요."); return; }
      postData.eventDate = Timestamp.fromDate(new Date(dateStr));
      postData.maxAttendees = maxAttendees;
      postData.attendees = [currentUser.uid];
    }

    try {
      const ref = await addDoc(collection(db, "posts"), postData);
      location.href = `/post.html?id=${ref.id}`;
    } catch (err) {
      showError("등록 중 오류가 발생했습니다.");
    }
  });

  function showError(msg) {
    const el = document.getElementById("msg-error");
    el.textContent = msg;
    el.style.display = "block";
  }
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add write.html assets/js/write.js
  git commit -m "feat: add write page for event and notice posts"
  ```

---

## Task 7: 게시판 메인 페이지 (`/board.html`)

**Files:**
- Create: `board.html`
- Create: `assets/js/board.js`
- Create: `assets/css/board.css`

- [ ] **Step 1: board.css 생성**

  ```css
  /* assets/css/board.css */
  .notice-item { border-left: 3px solid #0d6efd; padding-left: 12px; margin-bottom: 8px; }
  .event-row:hover { background: #f8f9fa; cursor: pointer; }
  .badge-full { background: #dc3545; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }
  .badge-open { background: #198754; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }
  .fc-event { cursor: pointer; }
  ```

- [ ] **Step 2: board.html 생성**

  ```html
  ---
  layout: default
  title: 게시판
  ---
  <link rel="stylesheet" href="/assets/css/board.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css">

  <div class="mt-4">
    <!-- 공지 섹션 -->
    <div class="mb-4">
      <h5>공지사항</h5>
      <div id="notice-list">불러오는 중...</div>
    </div>

    <hr>

    <!-- 일정 게시판 -->
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">일정 게시판</h5>
      <div>
        <button class="btn btn-sm btn-outline-secondary me-2" id="btn-calendar-view">캘린더</button>
        <button class="btn btn-sm btn-outline-secondary me-2" id="btn-list-view">목록</button>
        <a href="/write.html" class="btn btn-sm btn-primary">일정 등록</a>
      </div>
    </div>

    <div id="calendar-view">
      <div id="calendar"></div>
    </div>

    <div id="list-view" style="display:none">
      <table class="table table-hover">
        <thead><tr><th>날짜</th><th>제목</th><th>참석</th></tr></thead>
        <tbody id="event-list">불러오는 중...</tbody>
      </table>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
  <script type="module" src="/assets/js/board.js"></script>
  ```

- [ ] **Step 3: board.js 생성**

  ```js
  // assets/js/board.js
  import { db } from "./firebase-init.js";
  import { requireApproved } from "./auth-guard.js";
  import {
    collection, query, where, orderBy, limit, getDocs
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  requireApproved(async () => {
    await loadNotices();
    const events = await loadEvents();
    renderCalendar(events);
    renderList(events);
    setupViewToggle();
  });

  async function loadNotices() {
    const q = query(
      collection(db, "posts"),
      where("type", "==", "notice"),
      orderBy("createdAt", "desc"),
      limit(3)
    );
    const snap = await getDocs(q);
    const el = document.getElementById("notice-list");
    if (snap.empty) { el.innerHTML = "<p class='text-muted'>공지사항이 없습니다.</p>"; return; }
    el.innerHTML = snap.docs.map(d => {
      const p = d.data();
      const date = p.createdAt?.toDate().toLocaleDateString("ko-KR") || "";
      return `<div class="notice-item">
        <a href="/post.html?id=${d.id}">${p.title}</a>
        <span class="text-muted ms-2 small">${date}</span>
      </div>`;
    }).join("");
  }

  async function loadEvents() {
    const q = query(
      collection(db, "posts"),
      where("type", "==", "event"),
      orderBy("eventDate", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  function renderCalendar(events) {
    const calEl = document.getElementById("calendar");
    const calendar = new FullCalendar.Calendar(calEl, {
      initialView: "dayGridMonth",
      locale: "ko",
      events: events.map(e => ({
        id: e.id,
        title: e.title,
        start: e.eventDate.toDate()
      })),
      eventClick: (info) => { location.href = `/post.html?id=${info.event.id}`; }
    });
    calendar.render();
  }

  function renderList(events) {
    const el = document.getElementById("event-list");
    if (!events.length) { el.innerHTML = `<tr><td colspan="3" class="text-muted">등록된 일정이 없습니다.</td></tr>`; return; }
    el.innerHTML = events.map(e => {
      const date = e.eventDate?.toDate().toLocaleDateString("ko-KR") || "";
      const cnt = e.attendees?.length || 0;
      const badge = cnt >= e.maxAttendees
        ? `<span class="badge-full">${cnt}/${e.maxAttendees} 마감</span>`
        : `<span class="badge-open">${cnt}/${e.maxAttendees}</span>`;
      return `<tr class="event-row" onclick="location.href='/post.html?id=${e.id}'">
        <td>${date}</td><td>${e.title}</td><td>${badge}</td>
      </tr>`;
    }).join("");
  }

  function setupViewToggle() {
    document.getElementById("btn-calendar-view").addEventListener("click", () => {
      document.getElementById("calendar-view").style.display = "block";
      document.getElementById("list-view").style.display = "none";
    });
    document.getElementById("btn-list-view").addEventListener("click", () => {
      document.getElementById("calendar-view").style.display = "none";
      document.getElementById("list-view").style.display = "block";
    });
  }
  ```

- [ ] **Step 4: 커밋**

  ```bash
  git add board.html assets/js/board.js assets/css/board.css
  git commit -m "feat: add board page with calendar and list view"
  ```

---

## Task 8: 게시글 상세 페이지 (`/post.html`)

**Files:**
- Create: `post.html`
- Create: `assets/js/post.js`

- [ ] **Step 1: post.html 생성**

  ```html
  ---
  layout: default
  title: 게시글
  ---
  <link rel="stylesheet" href="/assets/css/board.css">

  <div class="mt-4">
    <div id="post-content">불러오는 중...</div>

    <!-- 참석 섹션 (event만) -->
    <div id="section-attendees" style="display:none" class="mt-4">
      <h5>참석 현황 <span id="attendee-count"></span></h5>
      <div id="attendee-list" class="mb-3"></div>
      <button id="btn-attend" class="btn btn-success" style="display:none">참석 신청</button>
      <button id="btn-cancel" class="btn btn-outline-danger" style="display:none">참석 취소</button>
      <p id="msg-full" class="text-danger mt-2" style="display:none">정원이 마감됐습니다.</p>
    </div>

    <!-- 댓글 섹션 (event만) -->
    <div id="section-comments" style="display:none" class="mt-5">
      <h5>댓글</h5>
      <div id="comment-list" class="mb-3"></div>
      <form id="form-comment">
        <div class="input-group">
          <input type="text" id="input-comment" class="form-control" placeholder="댓글을 입력하세요" maxlength="200">
          <button type="submit" class="btn btn-primary">등록</button>
        </div>
      </form>
    </div>

    <div class="mt-3">
      <a href="/board.html" class="btn btn-outline-secondary btn-sm">목록으로</a>
    </div>
  </div>

  <script type="module" src="/assets/js/post.js"></script>
  ```

- [ ] **Step 2: post.js 생성**

  ```js
  // assets/js/post.js
  import { auth, db } from "./firebase-init.js";
  import { requireApproved, getUserDoc } from "./auth-guard.js";
  import {
    doc, getDoc, updateDoc, arrayUnion, arrayRemove,
    collection, query, where, orderBy, getDocs,
    addDoc, deleteDoc, serverTimestamp, runTransaction
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  const postId = new URLSearchParams(location.search).get("id");
  let currentUser = null;
  let currentUserData = null;
  let postData = null;

  requireApproved(async (user, userData) => {
    currentUser = user;
    currentUserData = userData;
    await loadPost();
  });

  async function loadPost() {
    const snap = await getDoc(doc(db, "posts", postId));
    if (!snap.exists()) { document.getElementById("post-content").innerHTML = "<p>게시글을 찾을 수 없습니다.</p>"; return; }
    postData = snap.data();

    const date = postData.createdAt?.toDate().toLocaleDateString("ko-KR") || "";
    const authorDoc = await getUserDoc(postData.authorUid);
    const authorName = authorDoc?.nickname || "알 수 없음";

    let eventInfo = "";
    if (postData.type === "event") {
      const eventDate = postData.eventDate?.toDate().toLocaleDateString("ko-KR") || "";
      eventInfo = `<p class="text-muted">📅 일정 날짜: <strong>${eventDate}</strong></p>`;
    }

    document.getElementById("post-content").innerHTML = `
      <h2>${postData.title}</h2>
      <p class="text-muted small">${authorName} · ${date}</p>
      ${eventInfo}
      <hr>
      <div style="white-space:pre-wrap">${postData.content}</div>
    `;

    if (postData.type === "event") {
      await loadAttendees();
      setupAttendButtons();
      document.getElementById("section-comments").style.display = "block";
      await loadComments();
      setupCommentForm();
    }
  }

  async function loadAttendees() {
    const attendees = postData.attendees || [];
    document.getElementById("section-attendees").style.display = "block";
    document.getElementById("attendee-count").textContent = `(${attendees.length}/${postData.maxAttendees}명)`;

    const names = await Promise.all(attendees.map(async (uid) => {
      const u = await getUserDoc(uid);
      return u?.nickname || "알 수 없음";
    }));
    document.getElementById("attendee-list").innerHTML = names
      .map(n => `<span class="badge bg-secondary me-1">${n}</span>`).join("");
  }

  function setupAttendButtons() {
    const attendees = postData.attendees || [];
    const isAttending = attendees.includes(currentUser.uid);
    const isFull = attendees.length >= postData.maxAttendees;

    document.getElementById("btn-attend").style.display = (!isAttending && !isFull) ? "inline-block" : "none";
    document.getElementById("btn-cancel").style.display = isAttending ? "inline-block" : "none";
    document.getElementById("msg-full").style.display = (!isAttending && isFull) ? "block" : "none";

    document.getElementById("btn-attend").addEventListener("click", async () => {
      // 트랜잭션으로 선착순 초과 방지
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "posts", postId);
        const latest = await tx.get(ref);
        const latestAttendees = latest.data().attendees || [];
        if (latestAttendees.length >= postData.maxAttendees) throw new Error("마감");
        if (latestAttendees.includes(currentUser.uid)) throw new Error("이미 신청");
        tx.update(ref, { attendees: arrayUnion(currentUser.uid) });
      });
      location.reload();
    });

    document.getElementById("btn-cancel").addEventListener("click", async () => {
      await updateDoc(doc(db, "posts", postId), { attendees: arrayRemove(currentUser.uid) });
      location.reload();
    });
  }

  async function loadComments() {
    const q = query(
      collection(db, "comments"),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    const el = document.getElementById("comment-list");
    if (snap.empty) { el.innerHTML = "<p class='text-muted small'>댓글이 없습니다.</p>"; return; }

    const rows = await Promise.all(snap.docs.map(async (d) => {
      const c = d.data();
      const u = await getUserDoc(c.authorUid);
      const name = u?.nickname || "알 수 없음";
      const date = c.createdAt?.toDate().toLocaleString("ko-KR") || "";
      const deleteBtn = (c.authorUid === currentUser.uid || currentUserData.isAdmin)
        ? `<button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="deleteComment('${d.id}')">삭제</button>`
        : "";
      return `<div class="mb-2 border-bottom pb-2">
        <strong>${name}</strong> <span class="text-muted small">${date}</span>${deleteBtn}
        <div>${c.content}</div>
      </div>`;
    }));
    el.innerHTML = rows.join("");
  }

  function setupCommentForm() {
    document.getElementById("form-comment").addEventListener("submit", async (e) => {
      e.preventDefault();
      const content = document.getElementById("input-comment").value.trim();
      if (!content) return;
      await addDoc(collection(db, "comments"), {
        postId, content,
        authorUid: currentUser.uid,
        createdAt: serverTimestamp()
      });
      location.reload();
    });
  }

  window.deleteComment = async (commentId) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    await deleteDoc(doc(db, "comments", commentId));
    location.reload();
  };
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add post.html assets/js/post.js
  git commit -m "feat: add post detail page with attendance and comments"
  ```

---

## Task 9: 네비게이션 및 헤더 연동

**Files:**
- Modify: `_includes/header.html`
- Modify: `_config.yml`

- [ ] **Step 1: _config.yml navigation 항목 추가**

  `_config.yml`의 `navigation` 블록에 게시판 항목 추가:

  ```yaml
  navigation:
      - title: 회칙
        url: /rules
      - title: 명예의 전당
        url: /honor
      - title: 콩툰
        url: /toon
      - title: 게시판
        url: /board
  ```

- [ ] **Step 2: header.html에 로그인/로그아웃 버튼 추가**

  `_includes/header.html`의 `</ul>` 바로 위에 추가:

  ```html
  <li id="nav-login" style="display:none"><a href="/login.html">로그인</a></li>
  <li id="nav-logout" style="display:none"><a href="#" id="btn-logout">로그아웃</a></li>
  ```

  `</div><!-- end .header -->` 바로 위에 추가:

  ```html
  <script type="module">
    import { auth } from "/assets/js/firebase-init.js";
    import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    onAuthStateChanged(auth, (user) => {
      document.getElementById("nav-login").style.display = user ? "none" : "list-item";
      document.getElementById("nav-logout").style.display = user ? "list-item" : "none";
    });
    document.getElementById("btn-logout")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      location.href = "/login.html";
    });
  </script>
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add _config.yml _includes/header.html
  git commit -m "feat: add board nav link and login/logout to header"
  ```

---

## Task 10: GitHub Pages 배포 및 최종 확인

- [ ] **Step 1: 전체 push**

  ```bash
  git push origin master
  ```

- [ ] **Step 2: GitHub Pages 빌드 확인**

  `https://konsent.github.io/jdk/` 에서 빌드 완료 대기 (보통 1~2분).

- [ ] **Step 3: 동작 확인 체크리스트**

  아래 순서로 직접 브라우저에서 확인:
  1. `/login.html` — 구글 로그인 팝업 뜨는지
  2. 신규 계정 → `/register.html` 리다이렉트 되는지
  3. 닉네임 입력 후 신청 → Firestore `users` 컬렉션에 `pending` 문서 생성됐는지 Firebase 콘솔에서 확인
  4. `/admin.html` — 운영자 계정으로 접근, 대기 목록에 뜨는지, 승인 버튼 동작하는지
  5. 승인 후 `/board.html` 접근 — 캘린더 뜨는지
  6. `/write.html` — 일정 등록 후 `/board.html` 캘린더에 표시되는지
  7. `/post.html` — 참석 신청/취소 동작, 선착순 마감 표시, 댓글 작성/삭제

- [ ] **Step 4: 이메일 가입 경로 확인**

  Firebase Console → Authentication → Users 탭에서 이메일 가입 계정 목록 확인.

---

## 참고: Firebase Spark(무료) 플랜 한도

| 항목 | 한도 | 예상 사용량 |
|------|------|------------|
| Firestore 읽기 | 50,000회/일 | 100명 × 수십 회 = 여유 있음 |
| Firestore 쓰기 | 20,000회/일 | 월 20건 게시글 = 여유 있음 |
| Auth 사용자 | 무제한 | 100명 이하 |
| 저장 용량 | 1 GiB | 텍스트만 = 여유 있음 |
