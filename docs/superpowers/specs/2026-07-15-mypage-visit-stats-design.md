# 내 정보 페이지 - 아지트 방문 통계 설계

## 배경

내 정보 페이지(`mypage.html`)에 사용자의 활동 이력을 보여주는 두 통계를 추가한다.

1. **아지트 방문 일수**: 참가 신청했고 실제 불참하지 않은(노쇼 아님) 일정의 날짜를 기준으로, 중복 날짜를 하루로 계산한 방문 일수. 같은 날 2개 이상의 일정에 참여해도 1일로 계산.
2. **참여 게임 세션 수**: 실제 참여(확정, 노쇼 아님)한 일정의 개수. 하루에 여러 일정에 참여하면 각각 별도로 카운트.

## 데이터 모델 (기존)

`posts/{postId}` 문서(`type === "event"`)에 이미 다음 필드가 있다:

- `eventDate`: 일정 날짜 (Timestamp)
- `attendees`: 신청자 uid 배열
- `confirmedAttendees`: 주최자가 마감 후 실제 참여자로 확정한 uid 배열 (노쇼 제외됨)
- `closedAt`: 주최자가 참가 확정을 마감한 시각 (있어야 `confirmedAttendees`가 최종 확정된 것으로 간주)

"실제 참여" 여부는 기존 코드(`functions/index.js`의 `onPostConfirmed`, `assets/js/stats.js`의 backfill)에서 이미 다음 조건으로 판정하고 있다:

```js
p.type === "event" && !!p.closedAt && (p.confirmedAttendees || []).includes(uid)
```

이 저장소에는 이 값을 저장하는 카운터가 없다 (`attendCount`는 신청 수일 뿐, 확정 참여 수가 아님). 트로피 계산 시에도 항상 그때그때 `posts`를 조회해서 계산한다.

## 계산 방식

**페이지 로드 시 실시간 계산.** 별도의 저장 카운터를 만들지 않는다. 이미 존재하는 온디맨드 계산 패턴을 그대로 따른다 (저장소에 확정 참여 수를 저장하는 카운터가 아예 없다는 기존 관례와 일치).

`assets/js/mypage.js`에서, 로그인한 유저의 uid로 다음을 수행:

```js
const q = query(
  collection(db, "posts"),
  where("type", "==", "event"),
  where("confirmedAttendees", "array-contains", uid)
);
const snap = await getDocs(q);
const confirmedEvents = snap.docs
  .map((d) => d.data())
  .filter((p) => !!p.closedAt);

const participatedSessions = confirmedEvents.length;

const visitDays = new Set(
  confirmedEvents
    .map((p) => p.eventDate?.toDate?.())
    .filter((d) => d instanceof Date)
    .map((d) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      return dt.getTime();
    })
).size;
```

날짜 dedupe 로직은 `hasConsecutiveDays`(`assets/js/trophy-conditions.js`) 내부에 이미 있는 것과 동일한 방식이지만, 로직이 짧아 별도 함수로 추출하지 않고 인라인으로 작성한다.

## UI

`mypage.html`의 "보유 트로피" 섹션(`#section-trophies`) 바로 위에 새 섹션을 추가한다. 기존 "내 평균 점수" 섹션과 동일한 라벨 스타일(`0.78rem` 굵은 회색 라벨 + 본문)을 따른다.

표시 형식: 한 줄 텍스트.

```
아지트 방문 일수 12일 · 참여 게임 세션 18회
```

## 에러 처리

기존 `computeAverages` 호출과 같은 try/catch 블록 안에서 계산한다. 조회 실패 시 콘솔 에러만 남기고 페이지 전체 렌더링은 계속 진행한다 (기존 rating stats 로딩 실패 처리와 동일한 패턴).

## 범위 밖

- 통계 값을 Firestore에 영구 저장하는 것 (카운터화) — 기존 관례에 없고, 트리거/백필 스크립트 동기화 부담만 늘어남.
- 통계 카드형 UI — 이번엔 텍스트 라벨로 충분.
