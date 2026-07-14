# BGG 게임 검색 연동 설계

## 배경

일정 등록 폼(`/write/`)에서 게임 이름을 검색해 BoardGameGeek(BGG)의 게임 정보를 가져오고,
여러 개를 선택해 하나의 일정에 태그처럼 붙일 수 있게 한다. 상세 페이지(`/post/`)에서는
등록된 게임들을 썸네일 카드로 보여준다.

## BGG API 조사 결과

- `GET https://boardgamegeek.com/xmlapi2/search?query={name}&type=boardgame` — 이름 부분일치 검색, XML로 후보 목록(id, name, yearPublished) 반환. 무료, 인증 불필요.
- `GET https://boardgamegeek.com/xmlapi2/thing?id={id}` — 개별 게임 상세(썸네일 이미지 URL 포함) 반환.
- **CORS 미지원** — 브라우저에서 직접 호출 불가. 서버 프록시 필요.
- 드물게 캐시 준비 중이라 빈 응답을 줄 수 있음 — 짧은 재시도로 흡수.

이 프로젝트는 Firebase Functions(Node 20, v2)가 이미 배포되어 있으므로(`functions/index.js`,
텔레그램 알림 함수 참고) 같은 곳에 프록시 함수를 추가하는 것이 가장 자연스럽다.

## 아키텍처

```
write.js (검색 input, 디바운스)
   -> GET /searchBoardGame?q=카탄        (Firebase Function, HTTPS)
        -> BGG xmlapi2/search 호출 & XML -> JSON [{bggId, name, yearPublished}]
   -> 사용자가 후보 선택
   -> GET /getBoardGameDetail?id=13       (Firebase Function, HTTPS)
        -> BGG xmlapi2/thing 호출 & XML -> JSON {bggId, name, yearPublished, thumbnail}
   -> 선택된 게임을 태그 목록에 추가 (클라이언트 상태, 배열)
   -> 폼 제출 시 games 배열을 posts 문서에 저장
```

검색 단계는 썸네일을 조회하지 않는다(후보가 여러 개일 수 있어 비용 낭비). 사용자가 실제로
고른 게임에 대해서만 thing API로 썸네일을 1회 조회한다.

## 데이터 모델

`posts` 컬렉션 문서에 필드 추가:

```js
games: [
  { bggId: "13", name: "Catan", yearPublished: 1995, thumbnail: "https://..." },
  ...
]
```

- 선택 사항. 없는 일정도 유효(빈 배열 또는 필드 자체 없음).
- 기존 문서엔 필드가 없으므로 읽는 쪽은 항상 `postData.games || []`로 처리.

## Firebase Functions 추가 (`functions/index.js`)

두 개의 `onRequest` HTTPS 함수:

1. **searchBoardGame** — `query` 파라미터로 BGG search API 호출, XML 파싱해 후보 배열(JSON)
   반환. 결과 없으면 빈 배열.
2. **getBoardGameDetail** — `id` 파라미터로 BGG thing API 호출, XML에서 이름/연도/썸네일
   추출해 단일 객체(JSON) 반환.

두 함수 모두 BGG의 202(캐시 준비 중) 응답 시 짧게(예: 1초 후 1회) 재시도하고, 그래도
실패하면 빈 배열/null과 함께 200을 반환한다 — 게임 검색 실패가 폼 자체를 막지 않도록.

XML 파싱은 별도 npm 패키지를 추가하지 않고, Node 내장 기능만으로 충분한 단순한
정규식/문자열 기반 추출로 처리한다(필요한 필드가 id, name, yearPublished, thumbnail
4개뿐이라 풀 XML 파서는 과함).

## write.js (일정 등록 폼) 변경

일정 필드 섹션에 "함께할 게임" 항목 추가:

- 검색 input (게임 이름 입력, 300ms 디바운스) → `searchBoardGame` 호출 → 드롭다운에
  후보(이름 + 연도) 표시
- 후보 클릭 → `getBoardGameDetail` 호출 → 결과를 "선택된 게임" 태그 목록에 카드로 추가,
  input은 비우고 검색창은 계속 재사용 가능
- 각 태그에 × 버튼으로 제거 가능
- 선택된 게임 배열은 클라이언트 상태로 들고 있다가, 제출 시 `postData.games`로 저장
- 게임 미선택 상태로도 제출 가능(필수 아님)
- 수정 모드(`loadForEdit`)에서는 기존 `post.games`를 태그 목록에 미리 채워둠

## post.js (상세 페이지) 변경

`postData.games?.length`가 있으면 일정 정보 아래에 "함께 할 게임" 섹션 렌더링:

- 썸네일 + 이름 카드 목록 (가로 나열, 반응형 줄바꿈)
- 카드 클릭 시 `https://boardgamegeek.com/boardgame/{bggId}` 새 탭으로 열림
- 게임이 없으면 섹션 자체를 렌더링하지 않음

## 에러 처리

- BGG 검색/조회 실패(네트워크 에러, 202 재시도 실패) 시 빈 배열/null 반환 — 검색창에는
  "검색 결과 없음" 정도만 표시, 폼 제출 자체는 막지 않음.
- 일정 등록/수정은 게임 정보 유무와 무관하게 항상 가능해야 함.

## 테스트

- `functions/index.test.js`에 `searchBoardGame`/`getBoardGameDetail`의 XML 파싱 로직에
  대한 최소 단위 테스트 추가(고정된 샘플 XML 응답을 넣고 파싱 결과 검증, BGG 202 응답
  케이스 포함).
