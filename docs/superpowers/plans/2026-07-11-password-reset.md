# 비밀번호 찾기(재설정) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `login.html`에 "비밀번호를 잊으셨나요?" 링크와 모달을 추가하고, Firebase Auth의 `sendPasswordResetEmail`을 호출해 비밀번호 재설정 이메일을 발송한다.

**Architecture:** 클라이언트 전용 변경. `login.html`에 admin.html의 기존 확인모달과 동일한 인라인 스타일 패턴으로 이메일 입력 모달을 추가하고, `assets/js/login.js`에 모달 열기/닫기와 `sendPasswordResetEmail` 호출 로직을 추가한다. 새 백엔드/Cloud Functions 없음.

**Tech Stack:** Firebase Auth (`firebase-auth.js` v10.12.2, 기존 import 확장), 순수 HTML/CSS/JS (기존 코드베이스에 프레임워크 없음).

## Global Constraints

- 재설정 결과는 계정 존재 여부와 무관하게 항상 동일한 안내 메시지를 표시한다: "입력하신 이메일로 재설정 링크를 보냈습니다. 계정이 존재하지 않는 경우 메일이 오지 않을 수 있습니다." (스펙: 흐름 섹션)
- 예외적으로 `auth/invalid-email` 등 순수 입력 형식 오류는 계정 존재 여부와 무관하므로 그대로 사용자에게 표시한다 (스펙: 흐름 섹션).
- 승인 상태(pending/approved/rejected)와 무관하게 Firebase Auth 계정만 있으면 재설정 가능해야 한다 — Firestore 상태 조회/분기를 추가하지 않는다 (스펙: 대상 계정 섹션).
- 새 Cloud Functions나 서버 컴포넌트를 추가하지 않는다 — Firebase Auth 내장 기능만 사용한다 (스펙: 변경 파일 섹션).

---

### Task 1: 로그인 페이지에 비밀번호 재설정 모달 + 로직 추가

**Files:**
- Modify: `login.html`
- Modify: `assets/js/login.js`

**Interfaces:**
- Consumes: 없음 (기존 `auth` export를 `firebase-init.js`에서 그대로 사용)
- Produces: 이 태스크가 유일한 태스크이므로 이후 태스크에서 참조할 인터페이스 없음

- [ ] **Step 1: `login.html`에 링크와 모달 마크업 추가**

`login.html`의 이메일 폼과 하단 링크 사이(현재 33-35번째 줄, "이메일로 로그인" 버튼 뒤)에 링크를 추가한다:

```html
      <button type="submit" class="btn-page-primary">이메일로 로그인</button>
      <div style="text-align:center;margin-top:10px">
        <a href="#" id="link-forgot-password" style="font-size:0.85rem;color:#666;text-decoration:underline">비밀번호를 잊으셨나요?</a>
      </div>
```

파일 최상단(6번째 줄, `<link rel="stylesheet" href="/assets/css/pages.css">` 바로 뒤)에 모달 마크업을 추가한다:

```html
<link rel="stylesheet" href="/assets/css/pages.css">

<!-- 비밀번호 재설정 모달 -->
<div id="reset-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;align-items:center;justify-content:center">
  <div style="background:#fff;border-radius:10px;padding:28px 28px 20px;max-width:360px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.18)">
    <p style="font-weight:700;font-size:1rem;margin:0 0 6px">비밀번호 재설정</p>
    <p style="font-size:0.88rem;color:#555;margin:0 0 14px">가입 시 사용한 이메일을 입력하면 재설정 링크를 보내드립니다.</p>
    <input type="email" id="input-reset-email" class="form-control" placeholder="이메일 주소" style="margin-bottom:12px">
    <p id="reset-modal-msg" style="font-size:0.85rem;margin:0 0 14px;display:none"></p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="reset-modal-cancel-btn" style="border:1px solid #ddd;background:#fff;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:0.88rem">취소</button>
      <button id="reset-modal-send-btn" style="border:none;background:#1a1a1a;color:#fff;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:0.88rem;font-weight:600">재설정 링크 보내기</button>
    </div>
  </div>
</div>
```

전체 파일은 다음과 같은 구조가 된다 (전체 재작성 아님 — 위 두 블록만 삽입):

```html
---
layout: default
title: 로그인
permalink: /login/
---
<link rel="stylesheet" href="/assets/css/pages.css">

<!-- 비밀번호 재설정 모달 -->
<div id="reset-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;align-items:center;justify-content:center">
  <div style="background:#fff;border-radius:10px;padding:28px 28px 20px;max-width:360px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.18)">
    <p style="font-weight:700;font-size:1rem;margin:0 0 6px">비밀번호 재설정</p>
    <p style="font-size:0.88rem;color:#555;margin:0 0 14px">가입 시 사용한 이메일을 입력하면 재설정 링크를 보내드립니다.</p>
    <input type="email" id="input-reset-email" class="form-control" placeholder="이메일 주소" style="margin-bottom:12px">
    <p id="reset-modal-msg" style="font-size:0.85rem;margin:0 0 14px;display:none"></p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="reset-modal-cancel-btn" style="border:1px solid #ddd;background:#fff;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:0.88rem">취소</button>
      <button id="reset-modal-send-btn" style="border:none;background:#1a1a1a;color:#fff;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:0.88rem;font-weight:600">재설정 링크 보내기</button>
    </div>
  </div>
</div>

<div class="page-wrapper">
  <div class="page-card">
    <h1 class="page-card__title">로그인</h1>
    <p class="page-card__subtitle">장단콩 게임 클럽에 오신 걸 환영합니다</p>

    <button id="btn-google" class="btn-page-google">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Google 계정으로 로그인
    </button>

    <div class="page-divider">또는</div>

    <form id="form-email" class="page-form" novalidate>
      <div class="mb-3">
        <label class="form-label">이메일</label>
        <input type="email" id="input-email" class="form-control" placeholder="이메일 주소" required>
      </div>
      <div class="mb-3">
        <label class="form-label">비밀번호</label>
        <input type="password" id="input-password" class="form-control" placeholder="비밀번호" required>
      </div>
      <button type="submit" class="btn-page-primary">이메일로 로그인</button>
      <div style="text-align:center;margin-top:10px">
        <a href="#" id="link-forgot-password" style="font-size:0.85rem;color:#666;text-decoration:underline">비밀번호를 잊으셨나요?</a>
      </div>
    </form>

    <div id="msg-error" class="page-msg page-msg--error" style="display:none"></div>
    <div id="msg-pending" class="page-msg page-msg--warning" style="display:none">승인 대기 중입니다. 운영자 승인 후 이용 가능합니다.</div>
    <div id="msg-rejected" class="page-msg page-msg--error" style="display:none">가입이 거절되었습니다. 운영자에게 문의하세요.</div>

    <div class="page-link">
      아직 회원이 아니신가요? <a href="/register/">회원가입 신청</a>
    </div>
  </div>
</div>

<script type="module" src="/assets/js/login.js"></script>
```

- [ ] **Step 2: `assets/js/login.js`에 `sendPasswordResetEmail` import 추가**

기존 import 구문을 다음과 같이 수정한다:

```javascript
import { auth, db } from "./firebase-init.js";
import {
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
```

- [ ] **Step 3: 모달 열기/닫기/발송 로직을 `assets/js/login.js` 끝에 추가**

파일 끝(`showError` 함수 뒤)에 다음을 추가한다:

```javascript
const resetModal = document.getElementById("reset-modal");
const resetEmailInput = document.getElementById("input-reset-email");
const resetModalMsg = document.getElementById("reset-modal-msg");

function openResetModal() {
  resetEmailInput.value = document.getElementById("input-email").value || "";
  resetModalMsg.style.display = "none";
  resetModal.style.display = "flex";
}

function closeResetModal() {
  resetModal.style.display = "none";
}

document.getElementById("link-forgot-password").addEventListener("click", (e) => {
  e.preventDefault();
  openResetModal();
});

document.getElementById("reset-modal-cancel-btn").addEventListener("click", closeResetModal);

resetModal.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeResetModal();
});

document.getElementById("reset-modal-send-btn").addEventListener("click", async () => {
  const email = resetEmailInput.value.trim();
  try {
    await sendPasswordResetEmail(auth, email);
    showResetModalMessage("입력하신 이메일로 재설정 링크를 보냈습니다. 계정이 존재하지 않는 경우 메일이 오지 않을 수 있습니다.", "#2e7d32");
  } catch (err) {
    if (err.code === "auth/invalid-email") {
      showResetModalMessage("이메일 형식이 올바르지 않습니다.", "#c62828");
    } else {
      showResetModalMessage("입력하신 이메일로 재설정 링크를 보냈습니다. 계정이 존재하지 않는 경우 메일이 오지 않을 수 있습니다.", "#2e7d32");
    }
  }
});

function showResetModalMessage(text, color) {
  resetModalMsg.textContent = text;
  resetModalMsg.style.color = color;
  resetModalMsg.style.display = "block";
}
```

- [ ] **Step 4: 정적 사이트 로컬 서버로 수동 확인**

Jekyll 프로젝트이므로 자동화된 JS 단위 테스트가 없다. 다음 명령으로 로컬 서버를 띄운다:

```bash
bundle exec jekyll serve
```

Expected: `http://localhost:4000/login/` 접속 가능.

- [ ] **Step 5: 브라우저에서 수동 시나리오 확인**

1. `/login/` 접속 → "비밀번호를 잊으셨나요?" 링크가 이메일 폼 버튼 아래 보이는지 확인.
2. 링크 클릭 → 모달이 뜨는지, 이메일 입력란에 로그인 폼에 입력해둔 이메일이 미리 채워지는지 확인.
3. 실제 가입된 이메일 주소를 입력하고 "재설정 링크 보내기" 클릭 → 안내 메시지가 초록색으로 뜨는지, 해당 메일함에 Firebase 재설정 메일이 도착하는지 확인.
4. 존재하지 않는 이메일 주소(`nonexistent-test@example.com` 등)를 입력하고 발송 → 동일한 안내 메시지가 뜨는지 확인 (에러가 노출되지 않아야 함).
5. 형식이 잘못된 이메일(`not-an-email`)을 입력하고 발송 → "이메일 형식이 올바르지 않습니다." 에러가 뜨는지 확인.
6. 모달 바깥 영역 클릭 또는 "취소" 버튼 클릭 → 모달이 닫히는지 확인.
7. Firebase 콘솔 → Authentication → Users에서 승인되지 않은(Firestore `status: pending`) 계정의 이메일로도 재설정 메일 발송이 성공하는지 확인 (Firestore 상태와 무관해야 함).

Expected: 모든 시나리오가 스펙대로 동작.

- [ ] **Step 6: 커밋**

```bash
git add login.html assets/js/login.js
git commit -m "feat: add password reset link and modal to login page"
```

---

## Self-Review 결과

- **Spec coverage:** 진입점(로그인 페이지 링크) → Step 1, 모달 UI(이메일 입력) → Step 1, 발송 로직 및 통일된 메시지 → Step 3, 입력 형식 오류만 별도 표시 → Step 3, 승인 상태 무관 동작(Firestore 미조회) → Step 3 (Firestore import 추가 안 함, 기존 `getDoc`/`doc`만 유지), 보안 확인 섹션은 별도 코드 없이 Firebase Auth 기본 동작이므로 태스크 불필요. 스펙의 "범위 밖" 항목(이메일 템플릿, 재설정 후 랜딩 페이지 커스터마이징)은 계획에 포함하지 않음 — 일치.
- **Placeholder 스캔:** "TBD"/"나중에" 등 없음, 모든 단계에 실제 코드 포함.
- **타입/이름 일관성:** `openResetModal`, `closeResetModal`, `showResetModalMessage` 함수명과 `reset-modal`, `input-reset-email`, `reset-modal-msg`, `reset-modal-cancel-btn`, `reset-modal-send-btn`, `link-forgot-password` DOM id가 Step 1(마크업)과 Step 3(로직) 전체에서 일관되게 사용됨.
