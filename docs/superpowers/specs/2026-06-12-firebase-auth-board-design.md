# 장단콩 클럽 — 회원제 + 일정 게시판 설계

**날짜:** 2026-06-12  
**스택:** Jekyll (GitHub Pages) + Firebase Authentication + Firestore  
**규모:** 최대 100명, 월 20건 이하 게시글

---

## 1. 전체 아키텍처

```
GitHub Pages (Jekyll 정적 사이트)
│
├── 기존 페이지 (rules, honor, toon...)
├── /login.html        ← 구글 로그인 + 이메일/비밀번호 로그인
├── /register.html     ← 닉네임 입력 → pending 등록
├── /board.html        ← 공지 + 일정 게시판 (캘린더/목록 뷰)
├── /post.html         ← 일정 상세 + 참석 신청 + 댓글
├── /write.html        ← 글 작성 (공지는 운영자만)
└── /admin.html        ← 가입 승인 + 회원 관리
         │
         ▼
   Firebase
   ├── Authentication  ← Google OAuth + 이메일/비밀번호
   └── Firestore DB    ← 유저, 게시글, 댓글
```

**핵심 흐름:**
1. 방문자가 구글 또는 이메일로 로그인 → Firebase Auth가 계정 생성
2. 신규 유저는 닉네임 입력 후 Firestore에 `pending` 상태로 등록
3. 운영자가 `/admin`에서 승인 → `approved`로 변경
4. 승인된 유저만 게시판 접근 가능 (Firestore 보안 규칙으로 강제)
5. 운영자 계정은 최초 1회 Firebase 콘솔에서 수동으로 `isAdmin: true` 설정

---

## 2. Firestore 데이터 구조

### `users/{uid}`
| 필드 | 타입 | 설명 |
|------|------|------|
| status | string | `"pending"` \| `"approved"` \| `"rejected"` |
| nickname | string | 가입 시 본인 입력, 게시판에 표시되는 이름 |
| createdAt | timestamp | 가입 신청 시각 |
| displayName | string | 구글 계정 이름 (운영자 승인 판단용, 내부에서만 표시) |
| email | string | 로그인 이메일 (운영자 승인 판단용, 내부에서만 표시) |
| isAdmin | boolean | 운영자 여부 |

> `displayName`, `email`은 `/admin` 페이지에서만 표시. 게시판에는 `nickname`만 노출.

### `posts/{postId}`
| 필드 | 타입 | 설명 |
|------|------|------|
| type | string | `"notice"` \| `"event"` |
| title | string | 제목 |
| content | string | 본문 (텍스트) |
| authorUid | string | 작성자 uid |
| createdAt | timestamp | 작성 시각 |
| updatedAt | timestamp | 수정 시각 |
| eventDate | timestamp | 일정 날짜 (`type === "event"`일 때만) |
| maxAttendees | number | 최대 참석 인원, 게시자 포함 (`type === "event"`일 때만) |
| attendees | array\<string\> | 참석 신청한 uid 목록, 게시자 uid 기본 포함 (`type === "event"`일 때만) |

### `comments/{commentId}`
| 필드 | 타입 | 설명 |
|------|------|------|
| postId | string | 연결된 게시글 id |
| content | string | 댓글 내용 |
| authorUid | string | 작성자 uid |
| createdAt | timestamp | 작성 시각 |

> 댓글은 `type === "event"` 게시글에만 허용. 공지(`notice`)에는 댓글 없음.

---

## 3. 페이지별 기능

### `/login.html`
- 구글 로그인 버튼
- 이메일 + 비밀번호 로그인 폼
- 로그인 후 상태 분기:
  - Firestore에 없음 → `/register.html`
  - `pending` → "승인 대기 중" 안내
  - `rejected` → "가입이 거절되었습니다" 안내
  - `approved` → `/board.html`

### `/register.html`
- 닉네임 입력 폼 (중복 불허)
- 이메일 가입자는 여기서 이메일/비밀번호도 입력
- 제출 시 Firestore에 `pending` 상태로 저장
- "운영자 승인 후 이용 가능합니다" 안내 메시지

### `/board.html`
- 상단: 공지 최신 3개 고정 표시
- 하단: 일정 게시판
  - **캘린더 뷰**: 월별 캘린더, 일정 날짜에 제목 표시, 클릭 시 상세 이동
  - **목록 뷰**: 최신순 목록, 날짜·제목·참석현황(`n/5명`) 표시
  - 뷰 전환 탭 제공
- 일정 등록 버튼: 승인된 회원 모두 표시

### `/post.html?id=xxx`
- 날짜, 제목, 내용, 작성자 닉네임
- 참석자 목록 (닉네임으로 표시) + `n/최대인원명` 현황
- 참석 신청 버튼: `attendees.length < maxAttendees`이고 미신청 상태일 때 활성
- 참석 취소 버튼: 본인이 신청한 경우 표시
- 선착순 초과 방지: Firestore 트랜잭션으로 동시 신청 시 중복/초과 방지
- 댓글 목록 + 작성 폼 (`type === "event"`만)
- 본인 댓글만 삭제 버튼 표시
- 공지(`type === "notice"`)는 댓글 섹션 없음

### `/write.html`
- 제목, 본문 입력
- 운영자: 글 타입 선택 (공지 / 일정)
- 일반 회원: 일정만 작성 가능
- `type === "event"` 선택 시 추가 필드:
  - 일정 날짜 (date picker)
  - 최대 참석 인원 (숫자 입력, 최소 1, 게시자 자동 포함)

### `/admin.html`
- 운영자(`isAdmin: true`)만 접근 가능, 아니면 리다이렉트
- **탭 1 — 승인 대기**: 닉네임, 구글 표시 이름, 이메일, 신청 시각, 승인/거절 버튼
- **탭 2 — 전체 회원**: 승인된 회원 목록, 닉네임, 가입일, 강제 탈퇴(status를 `rejected`로 변경) 버튼

---

## 4. Firebase 세팅 순서

### 4-1. Firebase 프로젝트 생성
1. [console.firebase.google.com](https://console.firebase.google.com) → "프로젝트 추가"
2. **Authentication** → 로그인 방법 → **Google** + **이메일/비밀번호** 활성화
3. **Firestore Database** → 지역: `asia-northeast3` (서울) → 테스트 모드로 시작

### 4-2. 웹 앱 등록
1. 프로젝트 설정 → "앱 추가" → 웹(`</>`)
2. `firebaseConfig` 객체 복사

### 4-3. Jekyll에 Firebase SDK 추가

`_includes/scripts.html`에 추가:
```html
<script type="module" src="/assets/js/firebase-init.js"></script>
```

`assets/js/firebase-init.js`:
```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js";

const firebaseConfig = {
  // Firebase 콘솔에서 복사한 값
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 4-4. Firestore 보안 규칙

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
      allow read: if request.auth.uid == uid || isAdmin();
      allow create: if request.auth.uid == uid;
      allow update: if isAdmin();
    }

    match /posts/{postId} {
      allow read: if isApproved();
      allow create: if isApproved();
      allow update: if isAdmin() ||
        request.auth.uid == resource.data.authorUid ||
        isApproved(); // 참석 신청/취소 (attendees 배열 업데이트)
      allow delete: if isAdmin() ||
        request.auth.uid == resource.data.authorUid;
    }

    match /comments/{commentId} {
      allow read: if isApproved();
      allow create: if isApproved();
      allow delete: if isAdmin() ||
        request.auth.uid == resource.data.authorUid;
    }
  }
}
```

### 4-5. 운영자 계정 초기 설정
최초 가입 후 Firebase 콘솔 → Firestore → `users` 컬렉션에서 본인 uid 문서를 찾아 수동으로:
- `isAdmin: true`
- `status: "approved"`

이후 모든 관리는 `/admin` 페이지에서 가능.

---

## 5. 개인정보 최소화 원칙

- 게시글·댓글에는 `authorUid`만 저장, 이름/이메일 없음
- 화면에는 `nickname`만 표시
- `displayName`(구글 이름), `email`은 `/admin` 페이지에서만 노출
- Firebase Auth에는 구글이 넘겨주는 정보가 자동 저장됨 (구글 정책상 불가피)
- 우리 Firestore에는 승인 판단에 필요한 최소 정보만 보관

---

## 6. 캘린더 라이브러리

순수 Vanilla JS로 캘린더를 직접 구현하는 대신 경량 라이브러리를 사용:
- **FullCalendar** (CDN으로 로드 가능, 무료) — 추천
- 일정 데이터를 Firestore에서 가져와 FullCalendar에 events로 전달
