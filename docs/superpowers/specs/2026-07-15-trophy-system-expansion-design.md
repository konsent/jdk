# 트로피 시스템 확장 설계 (13종 추가)

## 개요

`2026-07-15-trophy-system-design.md`에서 구현한 5종 트로피(콩즈 죽돌이/개근왕, 일정 메이커, 만석 달성왕, 2048 간판왕)는 그대로 유지한다. 이 문서는 13종 신규 트로피와, 그 판정에 필요한 신규 Cloud Function 트리거 3개(`posts`, `parties`, `users`, `suika_scores`)를 정의한다. 트로피 총 개수는 18종이 된다.

기존 설계의 데이터 모델(`users/{uid}.trophies: [{id, earnedAt, seen}]`), 팝업 방식(다음 페이지 로드 시 1회, `.victory-overlay` 재사용), 트로피 정의 위치(`functions/trophies.js` 코드 상수 + `assets/js/trophies-meta.js` 클라이언트 미러)는 이번 확장에도 동일하게 적용된다.

## 신규 트로피 정의

| id | 이름 | 조건 | 데이터 소스 |
|---|---|---|---|
| `annual-member` | 연회원 가입 | `users/{uid}.annualMember === true` | `users` 문서 |
| `paju-ghost-1` | 파주 귀신 I | 누적 출석 50회 (`attendCount >= 50`) | `stats/global` |
| `paju-ghost-2` | 파주 귀신 II | 누적 출석 75회 (`attendCount >= 75`) | `stats/global` |
| `paju-ghost-3` | 파주 귀신 III | 누적 출석 100회 (`attendCount >= 100`) | `stats/global` |
| `no-noshow-20` | 불참 없이 참석 20회 | `confirmedAttendees` 포함 이벤트(마감된 것만) 누적 20회 | `posts` |
| `five-day-streak` | 5일 연속 참여 | `confirmedAttendees` 기준 실제 참석 날짜가 달력상 연속 5일 | `posts` |
| `suika-master` | 콩드랍 마스터 | `suika_scores`에서 `best` 전체 1위 | `suika_scores` |
| `party-planner` | 파티 플래너 | 현재 보유 중인 파티(`parties`, `ownerUid` 기준) 3개 이상 | `parties` |
| `heartthrob` | 인기 만점 | 평균 평점(매너·실력·재만남 가중치는 `computeAverages`와 무관, 단순 평균) 4.5 이상, `ratingCount >= 10` | `stats/global` |
| `writing-master` | 글쓰기 장인 | 누적 게시글 30개 (`postCount >= 30`) | `stats/global` |
| `weekend-regular` | 주말 개근 | `confirmedAttendees` 기준 주말(토/일) 이벤트 실제 참석 누적 10회 | `posts` |
| `kongz-hot` | 콩즈 온도왕 | 콩즈 온도(`computeKongzTemp`) 60도 이상 | `stats/global` |
| `so-hot` | 쏘핫 | 콩즈 온도 62도 이상 | `stats/global` |

이미지 경로는 기존과 동일한 규칙: `/assets/trophies/{id}.png` (실제 이미지 파일 제작은 범위 밖).

## 판정 트리거

### 1. `stats/global` 트리거 확장 (기존 `onStatsUpdated`)

기존 로직(콩즈 죽돌이/개근왕, 일정 메이커, 만석 달성왕)에 다음을 추가:

- **파주 귀신 I·II·III**: `checkAttendanceTrophies`를 50/75/100 임계값까지 확장 (기존 10/30과 같은 배열에 이어서 반환).
- **글쓰기 장인**: `checkScheduleMakerTrophy`와 같은 방식으로 `postCount >= 30`을 추가 반환하는 함수로 확장(또는 별도 함수).
- **인기 만점**: `memberStats.ratingSum`/`ratingCount`에서 단순 평균 `(manner+skill+again)/3/count`를 계산해 4.5 이상이고 `ratingCount >= 10`이면 충족. `rating-logic.js`의 `computeAverages`가 반환하는 개별 항목 평균(manner/skill/again)을 다시 평균낸다 — 새 계산식 도입이 아니라 기존 `computeAverages` 결과의 산술평균.
- **콩즈 온도왕 / 쏘핫**: `rating-logic.js`의 `computeKongzTemp(memberStats)`를 그대로 이식(Cloud Functions에는 ESM import가 아니라 동일 로직을 `functions/trophies.js`에 CommonJS로 재작성, 클라이언트와 로직은 동일하되 파일은 별도 — 기존 트로피 메타 이중관리와 같은 이유).

이 트리거는 이미 `members` 맵을 순회하며 `memberStats`를 들고 있으므로, 위 신규 조건들은 **추가 Firestore 쿼리 없이** 같은 순회 루프 안에서 판정 가능하다.

### 2. `posts/{postId}` 트리거 신규 (`onPostConfirmed`)

`confirmedAttendees` 필드가 쓰여질 때(즉 호스트가 참석 확정을 저장할 때) 발동하는 새 `onDocumentWritten("posts/{postId}", ...)` 트리거.

- `beforeData.confirmedAttendees`와 `afterData.confirmedAttendees`가 다를 때만 처리(불필요한 트리거 실행 방지 — 다른 필드 변경으로 인한 posts 쓰기까지 매번 전체 재계산하지 않도록).
- `afterData.closedAt`이 없으면(이벤트가 아직 마감되지 않았으면) **불참없이 20회/주말개근 카운트에서 제외** — 마감된 이벤트만 "확정된 실제 참석"으로 취급.
- 트리거가 발동한 이 posts 문서의 `afterData.confirmedAttendees` 배열에 담긴 각 uid에 대해 (이번에 확정된 참석자 전원을 대상으로 재판정):
  1. 해당 uid가 `confirmedAttendees`에 포함된 이벤트 전체를 조회한다 — Firestore 쿼리는 `collection("posts").where("type", "==", "event").where("confirmedAttendees", "array-contains", uid)`로 수행하고, `closedAt` 존재 여부는 Firestore 쿼리 조건이 아니라 **가져온 결과를 Cloud Function 코드 안에서 필터링**한다 (Firestore가 `array-contains`와 다른 필드의 조건을 함께 색인하려면 복합 색인이 필요하고, `closedAt`은 존재/부재만 확인하면 되므로 인메모리 필터가 더 단순하다).
  2. 이 이벤트 목록의 개수가 20 이상이면 `no-noshow-20` 후보에 추가.
  3. 이 이벤트 목록 중 `eventDate`의 요일이 토(6)/일(0)인 것만 필터링해 개수가 10 이상이면 `weekend-regular` 후보에 추가.
  4. 이 이벤트 목록의 `eventDate`를 날짜(연-월-일)만 추출해 정렬하고, 연속된 달력일 5일이 존재하는지 확인해 `five-day-streak` 후보에 추가 — 새 순수 함수 `hasConsecutiveDays(dates, 5)`로 구현(중복 날짜 제거 후 하루 단위 diff가 1인 구간이 5개 이상 이어지는지 검사).
- 판정된 후보 트로피들을 기존 `awardTrophies` 헬퍰로 기록.

**성능 참고**: 이 트리거는 `confirmedAttendees`가 바뀔 때마다, 그 안에 포함된 모든 uid 각각에 대해 posts 쿼리를 1회씩 실행한다(예: 참석자 5명짜리 이벤트를 확정하면 쿼리 5회). 클럽 규모(회원 수십 명, 이벤트도 빈번하지 않음)에서는 허용 가능한 수준이나, 사이트 성장 시 배치/캐싱을 고려할 수 있다는 점을 주석으로 남긴다.

### 3. `suika_scores/{uid}` 트리거 신규 (`onSuikaScoreUpdated`)

기존 `onGameScoreUpdated`(2048)와 완전히 동일한 패턴으로 별도 작성:

- `onDocumentWritten("suika_scores/{uid}", ...)`
- 전체 `suika_scores` 컬렉션을 조회해 `best` 필드 기준 최고점 보유자인지 확인 (`isTopScorer` 함수를 필드명 파라미터화하거나, 별도 `isTopScorerSuika`로 값만 다르게 재사용).
- `suika-master` 트로피 후보 판정 후 `awardTrophies` 호출.

### 4. `parties/{partyId}` 트리거 신규 (`onPartyUpdated`)

- `onDocumentWritten("parties/{partyId}", ...)`
- `afterData.ownerUid`가 존재하면(파티가 삭제된 경우 `afterData`가 없으므로 이 트리거는 생성/수정 시에만 유효 — **삭제 시에도 재판정이 필요**하다: 파티를 3개 만들었다가 하나 삭제해 2개가 되어도 이미 받은 트로피는 회수하지 않는 것이 기존 설계 원칙(`newlyEarnedTrophyIds`는 이미 가진 트로피를 제거하지 않음)과 일치하므로, 삭제 이벤트에서는 별도 처리 불필요 — 단, "3개 이상 보유"를 새로 만족하게 되는 시점은 생성/수정 시뿐이므로 삭제 트리거에서 판정할 필요가 원래 없다).
- `ownerUid`로 `parties` 컬렉션을 조회해 개수가 3 이상이면 `party-planner` 후보로 `awardTrophies` 호출.

### 5. `users/{uid}` 트리거 신규 (`onUserUpdated`)

- `onDocumentWritten("users/{uid}", ...)`
- `beforeData?.annualMember`가 `true`가 아니었는데 `afterData?.annualMember === true`가 된 경우에만 처리(불필요한 재판정 방지 — 매 `users` 문서 쓰기마다 전체 로직을 돌리지 않도록 가드).
- `annual-member` 트로피를 `awardTrophies`로 기록.
- **주의**: 기존 `notifyOnPendingSignup`도 `users/{uid}`에 `onDocumentWritten`을 걸고 있다. Firebase는 같은 문서 경로에 여러 트리거 함수를 등록하는 것을 허용하므로 (`exports.notifyOnPendingSignup`과 `exports.onUserUpdated`는 별개 함수) 충돌 없이 공존 가능 — 각 함수는 독립적으로 실행된다.

## 순수 함수 목록 (`functions/trophies.js` 확장)

기존 `checkAttendanceTrophies`, `checkScheduleMakerTrophy`, `checkFullHouseTrophy`, `checkGame2048Trophy`, `newlyEarnedTrophyIds`에 추가:

- `checkAttendanceTrophies(attendCount)`: 임계값 배열을 `[10, 30, 50, 75, 100]`으로 확장, 각각 `kongz-regular`/`kongz-veteran`/`paju-ghost-1`/`paju-ghost-2`/`paju-ghost-3` 반환.
- `checkWritingMasterTrophy(postCount)`: `postCount >= 30`이면 `["writing-master"]`.
- `checkHeartthrobTrophy(memberStats)`: `ratingCount >= 10`이고 3항목 평균 `>= 4.5`면 `["heartthrob"]`.
- `checkKongzTempTrophies(memberStats)`: `computeKongzTemp`를 이식한 내부 계산으로 60/62도 임계값 판정, `kongz-hot`/`so-hot` 반환.
- `checkAnnualMemberTrophy(annualMember)`: `true`면 `["annual-member"]`.
- `checkSuikaMasterTrophy(isTopScorer)`: `checkGame2048Trophy`와 동일 시그니처, `["suika-master"]` 반환.
- `checkPartyPlannerTrophy(partyCount)`: `partyCount >= 3`이면 `["party-planner"]`.
- `checkNoNoshowTrophy(confirmedEventCount)`: `>= 20`이면 `["no-noshow-20"]`.
- `checkWeekendRegularTrophy(weekendConfirmedCount)`: `>= 10`이면 `["weekend-regular"]`.
- `hasConsecutiveDays(dateList, n)`: `Date[]` 배열을 받아 연-월-일 단위로 중복 제거·정렬 후, 하루 간격으로 연속된 구간이 `n`일 이상 존재하면 `true`.
- `checkFiveDayStreakTrophy(hasStreak)`: `true`면 `["five-day-streak"]`.

## 클라이언트 메타 (`assets/js/trophies-meta.js`)

`TROPHIES_META` 배열에 위 13개 항목을 동일한 `{id, name, description, image}` 형태로 추가. 기존 5개와 합쳐 총 18개, 순서는 위 표 순서를 따른다.

## 범위 밖

- `posts` 트리거의 uid별 반복 쿼리를 배치/캐싱으로 최적화하는 작업 (현재 클럽 규모에서는 불필요)
- 파티가 삭제되어 3개 미만이 되었을 때 기존에 받은 `party-planner` 트로피를 회수하는 기능 (트로피는 한번 획득하면 유지되는 것이 기존 설계 원칙)
- "인기 만점"의 평균 계산식을 콩즈 온도와 같은 가중 평균으로 통일하는 것 (단순 평균으로 확정, 온도 계산과는 별개 지표로 유지)
- 트로피 이미지 파일 실제 제작 (기존과 동일하게 범위 밖)
