# 참석자 상호 평점 시스템 설계

## 개요

게임 일정(`posts` 중 `type: "event"`)에 참석한 사람들이 일정 종료 후 서로를 평가하는 기능. 평가 점수는 누적되어 개인 평균 점수로 반영된다.

## 흐름 요약

1. 사용자가 일정에 참석 신청 → `attendees` 배열에 등록 (기존 기능)
2. 일정 당일 자정이 지나면, 일정 상세 페이지에 "평가하기" 섹션이 열림
3. 참석자는 자신을 제외한 다른 참석자 각각에 대해 3개 항목(매너/실력/재만남 의향)을 5점 척도로 평가하거나 "불참"으로 표시
4. 제출한 평가는 수정 불가 (1회 제출로 고정)
5. 본인이 해당 일정의 평가를 전원 제출해야 다른 참석자들의 점수가 보임 (blind exchange)
6. 점수는 `stats/global`에 누적되어 개인 평균으로 계산됨

## 출석 확정 (사전 준비 단계)

- 신청자(`attendees`)와 실제 출석자가 다를 수 있음 (노쇼 등)
- 일정 작성자만 볼 수 있는 "출석 확정" UI를 상세 페이지에 추가: `attendees` 체크박스 목록 → 저장 시 `confirmedAttendees` 필드 생성
- 작성자가 보정하지 않으면 `confirmedAttendees`가 없는 상태 → 이 경우 평가 대상은 `attendees` 전체로 대체(fallback)
- 판정 책임자를 작성자 한 명으로 단일화하여, 참석자 간 불참 여부를 둘러싼 다수결/분쟁 로직을 없앤다

## 데이터 모델

### `posts/{postId}` (기존 문서에 필드 추가)
```
confirmedAttendees?: string[]   // uid 배열. 없으면 attendees로 fallback
```

### `ratings/{postId}_{raterUid}_{targetUid}` (신규 컬렉션)
```
{
  postId: string,
  raterUid: string,
  targetUid: string,
  noShow: boolean,        // true면 아래 점수 필드 없음
  manner?: 1-5,
  skill?: 1-5,
  again?: 1-5,
  createdAt: serverTimestamp
}
```
문서 ID를 `postId_raterUid_targetUid`로 고정 → 동일 대상 중복 제출이 구조적으로 불가능하며, 이것으로 "수정 불가" 요건도 충족한다 (재제출 시도는 이미 문서가 존재하므로 거부).

### `stats/global` (기존 문서에 필드 추가)
```
members.{uid}.ratingSum.manner: number
members.{uid}.ratingSum.skill: number
members.{uid}.ratingSum.again: number
members.{uid}.ratingCount: number   // noShow 평가는 카운트에서 제외
```
기존 `attendCount`/`postCount`와 동일한 `increment()` 누적 패턴을 따른다. 평균은 조회 시 `sum / count`로 계산하며 별도 저장하지 않는다.

## 화면 (post.js, 일정 상세 페이지)

### 출석 확정 섹션 (작성자 전용)
- `attendees` 목록을 체크박스로 표시, 기본값은 전원 체크
- 저장 버튼 클릭 시 `confirmedAttendees`에 체크된 uid만 저장
- 이미 확정된 경우 확정 목록을 기본값으로 다시 표시 (재수정 가능 — 평가 시작 전 실수 교정 목적)

### 평가 섹션 (참석자 전용, 자정 이후 노출)
- 노출 조건: `type === "event"` && 클라이언트 기준 오늘 날짜가 `eventDate` 다음날 이후 && 본인이 평가 대상(`confirmedAttendees` 또는 fallback `attendees`)에 포함
- 본인을 제외한 대상자 목록을 나열, 각 대상자마다:
  - "불참" 토글 (체크 시 점수 입력 UI 숨김)
  - 매너/실력/재만남 3개 점수 (1~5, 예: 별점 클릭 UI)
- 개별 대상자 단위로 이미 `ratings` 문서가 존재하면 "제출 완료"로 표시하고 입력 잠금
- 전원 제출 완료 시 섹션 전체를 "평가를 마쳤습니다"로 축약 표시

### 점수 열람
- 본인이 해당 일정에서 평가 대상 전원에 대해 제출을 완료해야 그 일정 참석자들의 평균 점수 열람 가능 (blind exchange)
- 완료 여부는 `ratings`에서 `postId + raterUid`로 문서 수를 세어, 평가 대상 인원 수와 비교해 판별
- 평균 점수 표시 위치는 이번 스코프에서는 별도 페이지 없이, 우선 마이페이지에 "내 평균 점수" 형태로 노출 (세부 UI는 구현 시 기존 마이페이지 패턴을 따름)

## 시간 판정

자정 경과 여부는 클라이언트의 `new Date()`와 `eventDate` 비교로 판단한다. Firestore 보안 규칙에서 서버 시간 기준 재검증은 하지 않는다 — 내부 친목 모임 앱으로 악의적 조작 유인이 낮고, 기존 코드도 마감 인원 체크 등을 트랜잭션+클라이언트 조합으로만 처리해온 것과 일관된다.

## 범위 밖 (Out of scope)

- 평가 수정/취소 기능 (제출 즉시 고정)
- 평가자 실명 공개 (항상 비공개, 평균만 노출)
- 서버 사이드(Cloud Functions) 시간 검증
- 신청 취소자(attendees에서 빠진 사람)에 대한 평가 — 애초에 확정 목록에 없으므로 해당 없음
