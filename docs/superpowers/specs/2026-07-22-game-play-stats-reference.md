# 게임 플레이 통계 — 향후 트로피 연동 참고 문서

## 개요

일정(`posts`, `type: "event"`)이 마감(`closedAt` 생성)될 때, 해당 일정의 `games` 배열에 담긴 보드게임별 플레이 횟수를 `gamePlayStats` 컬렉션에 집계한다. 이 문서는 데이터만 정리하며, 이 데이터를 사용하는 트로피는 아직 없다 — 이후 게임 관련 트로피(예: "특정 게임 10회 플레이")를 추가할 때 참고한다.

## 데이터 모델

`gamePlayStats/{bggId}` 문서:

```js
{
  name: "Catan",       // 마지막으로 집계된 시점의 게임 이름 (BGG 상세 API 응답 기준)
  playCount: 12        // 마감된 일정에 이 게임이 등록된 누적 횟수
}
```

- 문서 ID는 BGG의 `bggId` (문자열).
- `playCount`는 `FieldValue.increment(1)`로 게임 1개당, 마감 1회당 1씩 증가.
- 같은 일정에 같은 게임을 두 번 태그하면(현재 UI로는 불가하지만 방어 목적 없음) 태그된 횟수만큼 증가 — 일정 단위가 아니라 `games` 배열 항목 단위로 카운트한다.

## 집계 시점과 트리거

`functions/index.js`의 `onPostClosed` (`onDocumentWritten("posts/{postId}", ...)`):

- 판정 함수 `becamePostClosed(beforeData, afterData)`가 `true`를 반환할 때만 집계한다.
  - 조건: `afterData.type === "event"` && 이전엔 `closedAt`이 없었는데 새로 생겼을 때.
  - **마감 전환 시 1회만 집계된다.** 마감 후 재수정되어도 다시 집계되지 않음(재수정 시 `beforeData.closedAt`이 이미 존재하므로).
- `afterData.games`(없으면 빈 배열로 간주)를 순회하며 각 게임의 `bggId`에 대해 `gamePlayStats/{bggId}`를 `merge: true`로 upsert.
- 개별 게임 갱신 실패는 `logger.error`로 남기고 다른 게임 처리는 계속 진행(한 게임의 실패가 전체를 막지 않음).

## 알고 있어야 할 제약

- **집계는 "마감된 일정에 게임이 태그됨"을 셀 뿐, 실제로 그 게임을 플레이했는지는 보장하지 않는다.** 마감은 참석 확정/평가 오픈을 위한 액션이라 게임을 실제로 안 했어도 카운트될 수 있음(설계 단계에서 감수하기로 한 트레이드오프).
- 일정 수정으로 `games` 배열이 바뀌어도(마감 전) 집계에 영향 없음 — 마감 시점의 최종 `games` 배열만 반영된다.
- 마감을 취소하는 UI/기능이 없으므로 `playCount` 감소(디크리먼트) 로직은 없다. 향후 마감 취소가 생기면 함께 고려 필요.
- 어느 일정(`postId`)에서 집계가 발생했는지는 남기지 않는다 — `gamePlayStats`는 순수 누적 카운터이며 역추적 불가. 일정별 이력이 필요해지면 별도 컬렉션(`postId` + `bggId` 페어) 추가가 필요하다(설계 당시 트레이드오프로 보류됨).

## 향후 트로피 연동 시 참고

트로피 정의는 `functions/trophies.js`에 `check(ctx) => boolean` 형태 순수 함수로 추가하는 기존 관례(`docs/superpowers/specs/2026-07-15-trophy-system-design.md` 참고)를 따른다.

예: "카탄 10회 플레이" 트로피를 추가한다면:

1. `gamePlayStats/{bggId}` 문서 하나만 읽으면 판정 가능 (`playCount >= 10`) → 다른 트로피처럼 무거운 컬렉션 쿼리 불필요.
2. 이 트로피는 **개인(uid) 트로피가 아니라 클럽 전체 공용 이정표**에 가깝다 — 기존 트로피들은 전부 `users/{uid}.trophies`에 개인별로 귀속되는데, 게임 플레이 횟수는 특정 유저 행동이 아니라 클럽 전체 활동의 누적이다. "누구에게 수여할지"를 먼저 설계해야 한다(예: 해당 일정 작성자에게? 참석자 전원에게? 아니면 유저 트로피가 아닌 클럽 전체 배지로?).
3. `onPostClosed` 트리거 안에서 게임별 집계 직후 트로피 후보를 판정하도록 확장하거나, `gamePlayStats` 자체에 대한 별도 `onDocumentWritten` 트리거를 새로 만드는 두 가지 선택지가 있다 — 후자가 "게임 통계 갱신"과 "트로피 판정" 책임을 분리해 기존 관례(예: `game_scores` → `onGameScoreUpdated`)에 더 가깝다.
