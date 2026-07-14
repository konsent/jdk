# 트로피(업적) 시스템 설계

## 개요

마이페이지(`mypage.js`) "내 정보" 탭 하단에 트로피 그리드를 추가한다. 획득 조건은 Cloud Function이 `stats/global` 문서 변경을 트리거로 서버에서 판정하고, `users/{uid}.trophies` 배열에 기록한다. 신규 획득 트로피는 다음 페이지 로드 시 `victory.js` 스타일 팝업으로 1회 안내한다.

## 데이터 모델

`users/{uid}` 문서에 필드 추가:

```js
trophies: [
  { id: "kongz-regular", earnedAt: Timestamp, seen: false },
  ...
]
```

- 기존 `users` 문서 구조에 필드만 추가. 별도 컬렉션 없음.
- `seen: false`인 항목이 있으면 클라이언트가 팝업을 띄우고 즉시 `seen: true`로 갱신한다.

## 트로피 정의 (`functions/trophies.js`)

ID, 이름, 설명, 이미지 경로, 조건 판정 함수를 코드 상수로 관리한다 (Firestore 설정 문서 없음, `honor.md`처럼 하드코딩이 이 프로젝트 관례).

| id | 이름 | 조건 | 이미지 |
|---|---|---|---|
| `kongz-regular` | 콩즈 죽돌이 | 누적 출석 10회 (`attendCount >= 10`) | `/assets/trophies/kongz-regular.png` |
| `kongz-veteran` | 콩즈 개근왕 | 누적 출석 30회 (`attendCount >= 30`) | `/assets/trophies/kongz-veteran.png` |
| `schedule-maker` | 일정 메이커 | 누적 게시글 등록 10개 (`postCount >= 10`) | `/assets/trophies/schedule-maker.png` |
| `full-house-king` | 만석 달성왕 | 본인이 등록한 이벤트 중 만석 5회 (`attendees.length >= maxAttendees`) | `/assets/trophies/full-house-king.png` |
| `game-2048-champion` | 2048 간판왕 | `game_scores`에서 `bestScore` 전체 1위 | `/assets/trophies/game-2048-champion.png` |

각 트로피는 `{ id, name, description, image, check(ctx) => boolean }` 형태의 객체로 정의. `check`는 판정에 필요한 데이터(`memberStats`, `fullCount`, `isTopScorer` 등)를 담은 `ctx`를 받는다.

## 판정 트리거 (`functions/index.js`)

`stats/global` 문서에 `onDocumentWritten` 트리거를 추가한다 (기존 `notifyOnPendingSignup`과 동일한 패턴).

트리거 실행 시:

1. 변경된 `members` 맵을 순회하며 각 `uid`에 대해 `kongz-regular`, `kongz-veteran`, `schedule-maker` 조건을 `attendCount`/`postCount`로 판정한다.
2. `full-house-king` 판정을 위해 해당 `uid`가 `authorUid`인 이벤트 posts를 쿼리해 `fullCount`를 계산한다 (`stats.js`의 `renderAwards` 로직과 동일한 방식, 판정이 필요한 uid에 한해서만 쿼리).
3. `game-2048-champion`은 `stats/global` 트리거 범위 밖이므로, `game_scores/{uid}` 문서에 대한 별도 `onDocumentWritten` 트리거를 추가해 판정한다 (전체 컬렉션에서 자신이 1위인지 확인).
4. 아직 보유하지 않은 트로피 중 조건을 만족하는 것이 있으면 `users/{uid}.trophies`에 `{ id, earnedAt: serverTimestamp(), seen: false }`를 추가한다 (이미 있는 트로피는 재판정하지 않음 — 배열에 해당 id가 없을 때만 추가).

## 팝업 (클라이언트)

- `victory.js`를 일반화해 이미지/문구를 인자로 받는 `showTrophyPopup({ image, name, description })` 형태로 확장하거나, 트로피 전용으로 별도 작은 모듈(`trophy-popup.js`)을 만든다 — 기존 `.victory-overlay` CSS/애니메이션을 재사용.
- 트리거 시점: `mypage.js`가 `requireApproved` 콜백에서 `userData.trophies`를 확인해 `seen: false`인 항목이 있으면 그중 하나씩 순서대로 팝업을 띄우고 `seen: true`로 `updateDoc`.
  - 여러 개 미확인 트로피가 있으면 순차적으로(애니메이션 종료 후 다음) 표시.
- 실시간 팝업(방금 조건 달성한 그 순간)은 범위 밖 — 다음 로그인/페이지 접속 시 확인하는 방식.

## 마이페이지 UI

`mypage.html`의 `#section-parties`와 탈퇴 버튼 사이에 트로피 섹션 추가:

```html
<div id="section-trophies" class="mb-4">
  <div style="...">보유 트로피</div>
  <div id="trophy-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:12px"></div>
</div>
```

- 원형 이미지(`border-radius:50%`)를 격자로 렌더링. 보유하지 않은 트로피는 흑백/반투명 처리로 미획득 표시.
- `title` 속성 또는 CSS `:hover` 툴팁으로 이름+설명 노출 (별도 라이브러리 없이 네이티브 `title` 속성으로 충분 — 다른 페이지에 이미 있는 커스텀 툴팁 패턴이 없다면 이 방식을 기본으로 한다).
- `mypage.js`가 `functions/trophies.js`와 동일한 트로피 메타(이름/설명/이미지)를 클라이언트에도 필요로 하므로, 메타 정의를 `assets/js/trophies-meta.js`로 별도 추출해 `functions/trophies.js`와 `mypage.js` 양쪽에서 각자 import한다 (Cloud Functions와 정적 사이트 자산은 별도 배포 단위라 파일 공유 불가 — 조건 판정 로직 없이 메타 정보만 중복 없이 유지하기 위해 각 런타임에 맞는 모듈로 분리).

## 범위 밖

- 실시간(조건 달성 즉시) 팝업 — 다음 페이지 로드 시 확인
- 월별 출석 트로피 (월별 집계 인프라 없음 — 대신 누적 출석 트로피 2종으로 대체)
- 트로피 조건을 관리자가 UI로 편집하는 기능 (코드 상수로 고정)
- 트로피 이미지 자체 제작 — 경로만 정의, 실제 이미지 파일은 추후 준비
