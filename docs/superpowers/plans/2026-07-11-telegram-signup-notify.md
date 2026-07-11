# 가입 신청 텔레그램 알림 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `users/{uid}` 문서의 `status`가 `pending`으로 바뀔 때(신규 가입 신청 또는 거절 후 재신청) Cloud Function이 텔레그램 채팅방으로 알림을 보낸다.

**Architecture:** Firebase Cloud Functions (Node.js, 1st gen `functions.firestore.document().onWrite`)가 `users/{uid}` 쓰기를 감시. 변경 후 `status === "pending"`이고 변경 전 `status !== "pending"`일 때만 텔레그램 Bot API `sendMessage`를 호출. 봇 토큰/chat ID는 Firebase Secret Manager에 저장, 클라이언트 코드는 전혀 수정하지 않는다.

**Tech Stack:** Firebase Functions v4 (Node.js 20), `node-fetch` 불필요 (Node 20은 전역 `fetch` 내장), Firebase CLI, Firestore.

## Global Constraints

- 봇 토큰과 chat ID는 코드/저장소에 평문으로 남기지 않는다 — Firebase Secret Manager(`firebase functions:secrets:set`)만 사용한다 (스펙: 인프라 섹션).
- 알림은 `status`가 `pending`으로 **전이될 때만** 보낸다 — 승인/거절/강제탈퇴 등 다른 전이에서는 보내지 않는다 (스펙: 아키텍처 섹션).
- 텔레그램 API 실패가 가입 신청 자체를 실패시키지 않는다 — Firestore 쓰기는 이미 끝난 뒤의 부가 동작이므로 예외를 흡수하고 로그만 남긴다 (스펙: 에러 처리 섹션).
- 메시지 형식: `새 가입 신청: {nickname} ({email})\nhttps://www.jdkclub.click/admin/` (스펙: 아키텍처 섹션).
- 기존 정적 사이트 배포 경로(Jekyll/GitHub Pages)와 Cloud Functions 배포는 독립적 — `functions/`는 별도 npm 프로젝트로 관리한다.

---

## Firebase 콘솔에서 해야 하는 작업 (코드 밖 사전 준비)

이 플랜의 Task들은 로컬에서 코드를 작성하고 CLI로 배포하지만, **아래 항목은 Firebase 콘솔(웹 UI)에서 사람이 직접 눌러야 하는 작업**이다. Task 1 시작 전에 완료되어 있어야 CLI 배포가 성공한다.

1. **Blaze(종량제) 요금제로 업그레이드**
   - https://console.firebase.google.com → 프로젝트 `jdk-member-board` 선택 → 좌측 하단 "업그레이드" (또는 프로젝트 설정 → 사용량 및 결제) → Blaze 플랜 선택 → 결제 카드 등록.
   - Cloud Functions는 Spark(무료) 플랜에서 배포 자체가 불가능하다. 이 알림 트래픽 규모는 무료 할당량 내라 실질 과금은 없다.
2. **Cloud Functions API / Cloud Build API 활성화**
   - Blaze 업그레이드 시 보통 자동으로 활성화 안내가 뜬다. 안 뜬다면 https://console.cloud.google.com/apis/library 에서 프로젝트를 `jdk-member-board`로 선택 후 "Cloud Functions API"와 "Cloud Build API"를 검색해 사용 설정.
3. **콘솔에서 직접 만들 것은 없음** — Firestore 트리거, 함수 자체는 전부 CLI 배포(`firebase deploy --only functions`)로 생성되므로 콘솔에서 함수를 수동으로 만들 필요는 없다. 배포 후 Firebase 콘솔 → Functions 메뉴에서 배포된 함수와 실행 로그를 확인만 하면 된다.
4. **텔레그램 봇 토큰 / chat ID는 콘솔이 아니라 로컬 CLI로 등록** (Task 3에서 다룸) — Firebase 콘솔에는 입력할 곳이 없다.

---

### Task 1: Firebase 프로젝트 스캐폴딩 (functions/ 디렉터리, firebase.json, .firebaserc)

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `functions/package.json`
- Create: `functions/.gitignore`
- Create: `functions/index.js` (빈 골격만, Task 2에서 채움)

**Interfaces:**
- Consumes: 없음 (첫 Task)
- Produces: `functions/` npm 프로젝트, `firebase deploy --only functions` 실행 가능한 상태. 이후 Task는 `functions/index.js`를 수정한다.

- [ ] **Step 1: Firebase CLI 설치 확인 및 로그인**

```bash
npm install -g firebase-tools
firebase --version
firebase login
```
Expected: 버전 출력, 로그인 완료(브라우저 인증). 이미 로그인되어 있다면 `firebase login` 은 "Already logged in" 출력.

- [ ] **Step 2: `.firebaserc` 작성**

```json
{
  "projects": {
    "default": "jdk-member-board"
  }
}
```
(프로젝트 ID는 `assets/js/firebase-init.js`의 `projectId: "jdk-member-board"`와 동일해야 한다.)

- [ ] **Step 3: `firebase.json` 작성**

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}
```

- [ ] **Step 4: `functions/package.json` 작성**

```json
{
  "name": "functions",
  "description": "Cloud Functions for jdk-member-board",
  "engines": { "node": "20" },
  "main": "index.js",
  "type": "commonjs",
  "dependencies": {
    "firebase-admin": "^12.1.0",
    "firebase-functions": "^5.0.0"
  },
  "private": true
}
```

- [ ] **Step 5: `functions/.gitignore` 작성**

```
node_modules/
.env
.env.*
```

- [ ] **Step 6: `functions/index.js` 골격 작성**

```javascript
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

exports.notifyOnPendingSignup = onDocumentWritten("users/{uid}", async (event) => {
  // Task 2에서 구현
});
```

- [ ] **Step 7: 의존성 설치**

```bash
cd functions && npm install && cd ..
```
Expected: `functions/node_modules/` 생성, 에러 없이 종료.

- [ ] **Step 8: Firebase 콘솔에서 Blaze 업그레이드 확인**

로컬에서 확인 불가 — 위 "Firebase 콘솔에서 해야 하는 작업" 섹션의 1, 2번이 완료되었는지 사용자에게 확인받는다. 완료되지 않았다면 다음 Step으로 넘어가지 않는다.

- [ ] **Step 9: 커밋**

```bash
git add firebase.json .firebaserc functions/package.json functions/.gitignore functions/index.js functions/package-lock.json
git commit -m "chore: scaffold firebase functions project"
```

---

### Task 2: `notifyOnPendingSignup` 함수 구현 (상태 전이 판별 + 텔레그램 전송)

**Files:**
- Modify: `functions/index.js`
- Create: `functions/index.test.js`

**Interfaces:**
- Consumes: `functions/package.json`의 `firebase-functions`, `firebase-admin` (Task 1에서 설치됨)
- Produces: `exports.notifyOnPendingSignup` — Firestore `users/{uid}` onWrite 트리거 함수. 순수 로직은 `shouldNotify(beforeData, afterData)` 와 `buildMessage(afterData)` 라는 이름의 순수 함수로 분리해 테스트 가능하게 만든다 (이후 Task 없음 — 이 함수들은 이 Task 내부에서만 쓰인다).

- [ ] **Step 1: 순수 로직 함수의 실패하는 테스트 작성**

```javascript
// functions/index.test.js
const assert = require("node:assert");
const { test } = require("node:test");
const { shouldNotify, buildMessage } = require("./index.js");

test("shouldNotify: pending으로 신규 생성되면 true", () => {
  assert.strictEqual(shouldNotify(undefined, { status: "pending" }), true);
});

test("shouldNotify: rejected에서 pending으로 재신청하면 true", () => {
  assert.strictEqual(shouldNotify({ status: "rejected" }, { status: "pending" }), true);
});

test("shouldNotify: pending에서 approved로 바뀌면 false", () => {
  assert.strictEqual(shouldNotify({ status: "pending" }, { status: "approved" }), false);
});

test("shouldNotify: pending 문서가 삭제되면(afterData undefined) false", () => {
  assert.strictEqual(shouldNotify({ status: "pending" }, undefined), false);
});

test("shouldNotify: pending에서 pending으로 변화 없으면 false", () => {
  assert.strictEqual(shouldNotify({ status: "pending" }, { status: "pending" }), false);
});

test("buildMessage: 닉네임과 이메일, admin 링크를 포함한다", () => {
  const msg = buildMessage({ nickname: "홍길동", email: "hong@example.com" });
  assert.strictEqual(
    msg,
    "새 가입 신청: 홍길동 (hong@example.com)\nhttps://www.jdkclub.click/admin/"
  );
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
cd functions && node --test index.test.js
```
Expected: FAIL — `shouldNotify`, `buildMessage`가 `index.js`에서 export되지 않음.

- [ ] **Step 3: `functions/index.js` 구현**

```javascript
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");

const ADMIN_URL = "https://www.jdkclub.click/admin/";

function shouldNotify(beforeData, afterData) {
  if (!afterData) return false;
  const wasPending = beforeData?.status === "pending";
  const isPending = afterData.status === "pending";
  return isPending && !wasPending;
}

function buildMessage(afterData) {
  return `새 가입 신청: ${afterData.nickname} (${afterData.email})\n${ADMIN_URL}`;
}

async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    throw new Error(`Telegram API error: ${res.status} ${await res.text()}`);
  }
}

exports.notifyOnPendingSignup = onDocumentWritten(
  { document: "users/{uid}", secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID] },
  async (event) => {
    const beforeData = event.data.before.exists ? event.data.before.data() : undefined;
    const afterData = event.data.after.exists ? event.data.after.data() : undefined;

    if (!shouldNotify(beforeData, afterData)) return;

    try {
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN.value(),
        TELEGRAM_CHAT_ID.value(),
        buildMessage(afterData)
      );
    } catch (err) {
      logger.error("텔레그램 알림 전송 실패", err);
    }
  }
);

exports.shouldNotify = shouldNotify;
exports.buildMessage = buildMessage;
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

```bash
cd functions && node --test index.test.js
```
Expected: 6개 테스트 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add functions/index.js functions/index.test.js
git commit -m "feat: notify telegram when signup status transitions to pending"
```

---

### Task 3: 시크릿 등록 + 배포 + 실제 알림 확인

**Files:** 없음 (설정/배포 작업)

**Interfaces:**
- Consumes: Task 1의 `firebase.json`/`.firebaserc`, Task 2의 `functions/index.js`
- Produces: 배포된 `notifyOnPendingSignup` 함수, 실제 텔레그램 알림 동작 확인

- [ ] **Step 1: 텔레그램 시크릿을 Firebase Secret Manager에 등록**

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```
프롬프트에 봇 토큰 값을 붙여넣는다.

```bash
firebase functions:secrets:set TELEGRAM_CHAT_ID
```
프롬프트에 chat ID 값을 붙여넣는다.

Expected: 각각 "Created a new secret version" 류의 성공 메시지.

- [ ] **Step 2: 배포**

```bash
firebase deploy --only functions
```
Expected: `notifyOnPendingSignup` 함수가 성공적으로 배포되었다는 로그와 함께 종료 (`✔  functions[notifyOnPendingSignup(...)]: Successful create operation.`). Blaze 업그레이드가 안 되어 있으면 여기서 결제 관련 에러가 난다 — 그 경우 "Firebase 콘솔에서 해야 하는 작업" 섹션 1번을 먼저 완료해야 한다.

- [ ] **Step 3: 실제 가입 신청으로 종단 테스트**

`register.html`에서 테스트 계정으로 가입 신청을 제출한다 (또는 Firebase 콘솔 → Firestore → `users` 컬렉션에서 테스트 문서를 `status: "pending"`으로 수동 생성).

Expected: 등록된 텔레그램 채팅방에 `새 가입 신청: {닉네임} ({이메일})\nhttps://www.jdkclub.click/admin/` 메시지 도착.

- [ ] **Step 4: 함수 로그 확인**

```bash
firebase functions:log --only notifyOnPendingSignup
```
Expected: 에러 로그 없음(성공 시). 텔레그램 전송이 실패했다면 여기서 "텔레그램 알림 전송 실패" 로그와 원인 확인.

- [ ] **Step 5: admin.html에서 승인 처리 시 알림이 오지 않는지 확인 (회귀 확인)**

Step 3에서 만든 테스트 신청을 `admin.html`에서 승인 처리한다.

Expected: 텔레그램에 추가 메시지가 오지 않는다 (승인은 `pending → approved` 전이이므로 `shouldNotify`가 `false`를 반환해야 정상).

- [ ] **Step 6: 테스트 데이터 정리**

Firebase 콘솔 → Firestore → `users` 컬렉션에서 Step 3의 테스트 문서를 삭제한다 (실제 서비스 데이터가 아닌 테스트용이므로).

---

## Self-Review 결과

- **Spec coverage:** 아키텍처(onWrite + status 전이 판별) → Task 2, 인프라(functions/ 디렉터리, firebase.json, Secret Manager, Blaze) → Task 1·3, 에러 처리(로그만 남김) → Task 2 Step 3, 메시지 포맷 → Task 2. 스펙의 "범위 밖" 항목(승인/거절 알림, 봇 생성 절차)은 계획에 포함하지 않음 — 일치.
- **Placeholder 스캔:** "TBD"/"나중에" 등 없음, 모든 코드 블록에 실제 코드 포함.
- **타입/이름 일관성:** `shouldNotify(beforeData, afterData)`, `buildMessage(afterData)` 이름이 Task 2 Interfaces와 구현, 테스트에서 동일하게 사용됨.
