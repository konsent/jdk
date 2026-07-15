# 트로피 소급 재계산(백필) 설계

## 배경

트로피 판정은 전부 Firestore `onDocumentWritten` 트리거로 동작한다. 즉 "조건을 이미 만족한 상태"가 아니라 "조건을 만족시키는 문서 쓰기가 방금 발생한 순간"에만 판정된다. 배포 시점에 이미 연회원이거나 파티 3개를 보유한 회원 등은 해당 필드가 다시 쓰이지 않는 한 트로피를 받지 못한다. 이 문서는 기존 회원의 과거 데이터를 훑어 18개 트로피 조건을 일괄 재판정하는 관리자 도구를 정의한다.

## 배치 위치

`stats.html`의 운영자 도구 섹션(`#admin-actions`)에 "트로피 소급 재계산" 버튼을 상시 배치한다. 기존 "통계 초기화 (전체 재계산)" 버튼과 같은 자리, 같은 스타일(`btn btn-sm btn-outline-secondary`)로 추가한다. 한 번 쓰고 지우는 일회성 스크립트가 아니라, 트로피 종류가 추가되거나 데이터 정합성 문제가 생겼을 때 다시 쓸 수 있도록 상시 유지한다.

## 판정 로직 재사용: `assets/js/trophy-conditions.js`

`functions/trophies.js`는 CommonJS라 브라우저에서 바로 import할 수 없다. 새 ESM 모듈 `assets/js/trophy-conditions.js`를 만들어 `functions/trophies.js`의 다음 함수들을 문법만 ESM으로 바꿔 동일하게 재작성한다(로직 변경 없음, `module.exports`→`export`만 차이):

- `checkAttendanceTrophies`, `checkScheduleMakerTrophy`, `checkFullHouseTrophy`, `checkWritingMasterTrophy`
- `checkHeartthrobTrophy`, `computeKongzTempServer`, `checkKongzTempTrophies`
- `checkGame2048Trophy`, `checkSuikaMasterTrophy`, `checkAnnualMemberTrophy`, `checkPartyPlannerTrophy`
- `checkNoNoshowTrophy`, `checkWeekendRegularTrophy`, `hasConsecutiveDays`, `checkFiveDayStreakTrophy`
- `newlyEarnedTrophyIds`

이미 `functions/trophies.js`(서버 판정 로직)와 `assets/js/trophies-meta.js`(클라이언트 메타)를 이중 관리하고 있으므로, 세 번째 파일이 추가되는 것도 같은 관례를 따른다. 두 판정 로직 파일의 결과가 일치하는지 확인하는 테스트를 추가한다(같은 입력에 같은 출력을 내는지, 대표 케이스로 회귀 확인).

## 데이터 수집

버튼 클릭 시 다음 6개 컬렉션을 각각 한 번씩 전체 로드한다:

1. `users` (전체) — 각 uid의 `annualMember`, `nickname`
2. `stats/global` (단일 문서) — `members[uid].attendCount`, `postCount`, `ratingCount`, `ratingSum`
3. `parties` (전체) — `ownerUid`별 개수 집계
4. `game_scores` (전체) — `bestScore` 기준 최고점자 판정(`isTopScorer` 로직과 동일하게 인라인)
5. `suika_scores` (전체) — `best` 기준 최고점자 판정
6. `posts` (`type == "event"`인 것만) — `authorUid`(만석 판정용), `confirmedAttendees`+`closedAt`+`eventDate`(불참없음/5일연속/주말개근 판정용)

전체 로드 후 메모리에서 uid별로 인덱싱/필터링해 Firestore 읽기 횟수를 회원 수가 아닌 컬렉션 수(6회)에 비례하게 유지한다.

## 회원별 판정

`users` 컬렉션의 모든 uid를 순회하며, 위에서 수집한 데이터로 18개 트로피 후보를 계산한다:

- **콩즈 죽돌이/개근왕, 파주귀신 I·II·III**: `checkAttendanceTrophies(stats.attendCount)`
- **일정 메이커, 글쓰기 장인**: `checkScheduleMakerTrophy`/`checkWritingMasterTrophy(stats.postCount)`
- **만석 달성왕**: `posts`에서 `authorUid === uid`인 이벤트 중 `attendees.length >= maxAttendees`인 것의 개수로 `checkFullHouseTrophy`
- **2048 간판왕**: `game_scores` 전체에서 해당 uid가 `bestScore` 최고치인지 확인 후 `checkGame2048Trophy`
- **콩드랍 마스터**: `suika_scores` 전체에서 해당 uid가 `best` 최고치인지 확인 후 `checkSuikaMasterTrophy`
- **인기 만점, 콩즈 온도왕, 쏘핫**: `checkHeartthrobTrophy`/`checkKongzTempTrophies(stats)`
- **연회원 가입**: `checkAnnualMemberTrophy(users[uid].annualMember)`
- **파티 플래너**: `parties`에서 `ownerUid === uid`인 개수로 `checkPartyPlannerTrophy`
- **불참없이 20회, 5일 연속 참여, 주말 개근**: `posts` 중 `type == "event"` && `closedAt` 존재 && `confirmedAttendees`에 uid 포함인 것만 필터링(기존 `onPostConfirmed` 트리거와 동일 기준) 후 `checkNoNoshowTrophy`/`checkWeekendRegularTrophy`/`checkFiveDayStreakTrophy(hasConsecutiveDays(...))`

## Firestore 쓰기

회원별로 판정된 후보 트로피 목록을 기존 `awardTrophies` 패턴과 동일하게 처리한다: `users/{uid}` 문서를 읽어 기존 `trophies` 배열과 비교(`newlyEarnedTrophyIds`)해 신규 트로피만 골라 `updateDoc`으로 `arrayUnion` 추가(`{id, earnedAt: serverTimestamp(), seen: false}`). `arrayUnion`은 멱등이라 실시간 트리거와 동시에 실행되어도 안전하다.

## 결과 표시

전체 처리가 끝나면 "N명에게 총 M개 트로피 신규 수여" 형태의 요약 텍스트를 기존 `#msg-action` 영역에 표시한다(회원별 상세 내역은 노출하지 않음). 특정 회원의 Firestore 쓰기가 실패해도 나머지 회원 처리는 계속 진행하고, 실패 건수가 있으면 요약에 포함한다("N명 처리, M개 수여, K명 실패").

## 범위 밖

- 이미 받은 트로피를 회수하는 기능 (트로피는 영구 보존이 설계 원칙)
- 백필 실행 이력을 별도로 저장/조회하는 기능
- 회원별 상세 수여 내역 UI (요약 텍스트로 충분)
