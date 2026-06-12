# 통계 페이지 설계

**날짜:** 2026-06-13  
**스택:** Jekyll (GitHub Pages) + Firebase Firestore + Chart.js (CDN) + Vanilla JS  
**접근 권한:** `isAdmin: true` 계정만

---

## 1. 전체 아키텍처

```
Firestore
├── posts/{postId}           ← 기존 (변경 없음)
├── users/{uid}              ← 기존 (변경 없음)
├── stats/global             ← 신규: 전체 누적 통계 단일 문서
└── monthly_stats/{YYYY-MM}  ← 신규: 월별 스냅샷 문서

Jekyll
└── /stats/                  ← 신규 페이지 (isAdmin만 접근)

JS
├── assets/js/stats.js       ← 신규: 통계 페이지 전용
├── write.js                 ← 수정: 게시글 등록 시 stats 업데이트
└── post.js                  ← 수정: 참석 신청/취소 시 stats 업데이트
```

**데이터 흐름:**
- 참석 신청 → `post.js`가 `stats/global`의 해당 uid `attendCount` +1
- 참석 취소 → `attendCount` -1 (0 미만 방지)
- 게시글 등록 → `write.js`가 해당 uid `postCount` +1
- 월말 운영자가 "이번 달 저장" 버튼 클릭 → `stats/global` 현재 상태를 `monthly_stats/YYYY-MM`에 복사

---

## 2. Firestore 데이터 구조

### `stats/global`
```
{
  updatedAt: timestamp,
  members: {
    "{uid}": {
      nickname: string,
      attendCount: number,   // 참석 신청 누적 (취소 시 감소, 0 미만 불가)
      postCount: number      // 일정 등록 누적
    }
  }
}
```

### `monthly_stats/{YYYY-MM}`
```
{
  savedAt: timestamp,
  savedBy: string,           // 저장한 운영자 nickname
  members: {
    "{uid}": {
      nickname: string,
      attendCount: number,
      postCount: number
    }
  }
}
```

**설계 결정:**
- `stats/global`은 단일 문서 → 통계 페이지 로딩 시 Firestore 읽기 1회
- 댓글은 통계 집계에서 제외
- 닉네임 변경 미지원으로 nickname 불일치 가능성 없음
- 기존 posts 데이터 마이그레이션: "통계 초기화" 버튼으로 posts 전체 순회 후 `stats/global` 재구성

---

## 3. Firestore 보안 규칙 추가

```
match /stats/{docId} {
  allow read: if isAdmin();
  allow write: if isAdmin();
}

match /monthly_stats/{docId} {
  allow read: if isAdmin();
  allow write: if isAdmin();
}
```

---

## 4. 통계 페이지 UI (`/stats/`)

### 상단 — 기간 필터
- `[ 전체 ]` `[ 2025 ]` `[ 2026 ]` 버튼
- 전체: `stats/global` 사용
- 연도별: 해당 연도의 `monthly_stats/YYYY-*` 문서들을 합산. 해당 연도 스냅샷이 없으면 "저장된 데이터 없음" 안내 표시
- `stats/global` 문서가 없으면 빈 상태로 처리 (초기화 버튼 안내)

### 차트 섹션 (Chart.js, 상위 10위만 표시)

**차트 1 — 참석 횟수 랭킹** (가로 막대 차트)
- attendCount 내림차순 정렬, 상위 10명
- 1위 강조 색상 적용

**차트 2 — 일정 등록 횟수 랭킹** (가로 막대 차트)
- postCount 내림차순 정렬, 상위 10명

**차트 3 — 월별 일정 수 추이** (세로 막대 차트)
- `posts` 컬렉션에서 실시간 집계 (eventDate 기준 월별 grouping)
- 기간 필터와 연동

### 재미있는 부문 (텍스트 카드, 상위 1인)

| 부문 | 설명 |
|------|------|
| 🏆 개근왕 | attendCount 1위 |
| 📅 일정 메이커 | postCount 1위 |
| ⚡ 만석 달성왕 | 본인이 등록한 일정 중 만석(attendees.length == maxAttendees) 달성 횟수 1위 |
| 🎯 참석률왕 | 본인이 등록한 일정의 만석 달성률(만석 일정 수 / 전체 등록 일정 수) 1위, 최소 1개 이상 등록한 사람 중 |

만석 달성왕/참석률왕은 `posts` 컬렉션 실시간 집계. 기간 필터와 무관하게 항상 전체 기간 기준으로 표시.

### 하단 — 운영자 전용 액션

| 버튼 | 동작 |
|------|------|
| 이번 달 통계 저장 | `stats/global`을 `monthly_stats/YYYY-MM`으로 복사, 이미 있으면 덮어씀 |
| 통계 초기화 | `posts` 전체 순회 → `attendees` 배열 기반으로 `stats/global` 재구성 |

**과거 월별 스냅샷 목록**
- `monthly_stats` 컬렉션의 문서 목록 표시
- 클릭 시 해당 월 데이터로 차트/랭킹 교체

---

## 5. write.js / post.js 수정 사항

### write.js — 게시글 등록 후
```js
// type === "event" 등록 시에만 postCount +1
await updateDoc(doc(db, "stats", "global"), {
  [`members.${user.uid}.nickname`]: currentUserData.nickname,
  [`members.${user.uid}.postCount`]: increment(1)
});
```

### post.js — 참석 신청 시
```js
await updateDoc(doc(db, "stats", "global"), {
  [`members.${currentUser.uid}.nickname`]: currentUserData.nickname,
  [`members.${currentUser.uid}.attendCount`]: increment(1)
});
```

### post.js — 참석 취소 시
```js
// attendCount가 0보다 클 때만 감소
const statsSnap = await getDoc(doc(db, "stats", "global"));
const current = statsSnap.data()?.members?.[currentUser.uid]?.attendCount || 0;
if (current > 0) {
  await updateDoc(doc(db, "stats", "global"), {
    [`members.${currentUser.uid}.attendCount`]: increment(-1)
  });
}
```
