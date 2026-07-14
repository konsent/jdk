# 커스텀 파티(고정 인원) 기능 설계

## 배경

프로스트헤이븐처럼 고정 인원이 여러 차례 게임을 함께하는 경우, 매번 일정 등록 시
참석자를 한 명씩 신청하는 대신 미리 만들어둔 "파티"를 선택해 참석 인원을 자동으로
채우고 싶다. 파티는 아무 유저나 자신의 마이페이지에서 만들고 관리한다.

## 데이터 모델

새 컬렉션 `parties`:

```js
parties/{partyId}
  ownerUid: string        // 파티를 만든 유저의 uid
  name: string            // 예: "프로스트헤이븐 파티"
  memberUids: string[]    // ownerUid 본인 포함, 승인된 유저의 uid 배열
  createdAt, updatedAt
```

- 한 유저가 여러 파티를 가질 수 있다.
- `posts` 문서와는 참조 관계를 두지 않는다. write 폼에서 파티를 선택하면 그 순간의
  `memberUids`를 `attendees`에 **일회성으로 복사**할 뿐이다. 이후 파티를 수정/삭제해도
  이미 등록된 일정에는 아무 영향이 없다.

## Firestore 규칙

`parties` 컬렉션은 콘솔에서 직접 규칙을 관리 중이므로(레포에 `firestore.rules` 없음),
아래 규칙을 **사용자가 Firebase 콘솔에서 직접 반영**해야 한다:

```
match /parties/{partyId} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerUid;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerUid;
}
```

파티는 소유자 본인만 읽고 쓸 수 있다(다른 유저의 파티 목록은 조회 불가).

## 컴포넌트 구성

`assets/js/party.js` (신규) — 파티 CRUD와 유저 검색을 담당하는 공통 모듈. mypage.js와
write.js 양쪽에서 가져다 쓴다.

```js
// party.js가 제공하는 함수
listMyParties(ownerUid)              // 내 파티 목록 조회
createParty(ownerUid, name, memberUids)
updateParty(partyId, name, memberUids)
deleteParty(partyId)
searchApprovedUsers(nicknameQuery)   // status == "approved" 유저 중 닉네임 검색
```

유저 검색은 `write.js`의 `loadAuthorOptions`(승인된 유저 전체 조회) 패턴을 재사용하되,
파티는 멤버가 소수이므로 클라이언트에서 닉네임 부분일치 필터링으로 충분하다(별도 서버
검색 함수 불필요).

## 마이페이지 (`mypage.html` / `mypage.js`) 변경

"내 파티" 섹션을 회원 탈퇴 섹션 위, `<hr>`로 구분해 추가한다.

- 내 파티 목록: 파티 이름 + 멤버 닉네임 chip들 + 수정/삭제 버튼
- "새 파티 만들기" 버튼 → 이름 입력 필드 + 닉네임 검색 input(승인된 유저 후보 표시,
  클릭해 멤버로 추가) + 추가된 멤버 chip 목록(× 버튼으로 제거) → 저장
- 본인(작성자)은 항상 멤버로 자동 포함되며 목록에서 제거할 수 없다.
- 수정 버튼 클릭 시 동일한 폼이 기존 이름/멤버로 채워진 상태로 열린다.
- 삭제는 확인 없이 즉시 처리한다(파티는 참석자를 미리 채우는 편의 기능일 뿐, 삭제해도
  기존 일정에 영향이 없으므로 기존 회원탈퇴 모달 같은 별도 확인 모달은 불필요).

## 글쓰기 페이지 (`write.html` / `write.js`) 변경

"최대 참석 인원" 필드 위에 "내 파티 불러오기" 드롭다운을 추가한다.

- 내 파티가 하나도 없으면 드롭다운 자체를 숨긴다.
- 드롭다운에서 파티를 선택하면:
  - `attendees` 초기값 = 해당 파티의 `memberUids`
  - `input-max`(최대 참석 인원) = 멤버 수로 자동 설정
  - 이후 사용자가 인원수를 늘리거나 게임 태그 등 다른 필드를 자유롭게 추가로 수정 가능
- 파티 선택은 신규 등록 시에만 노출한다(수정 모드에서는 이미 `attendees`가 존재하므로
  파티 재적용은 지원하지 않는다 — 기존 참석자를 덮어쓰는 혼란을 피한다).
- 드롭다운을 "선택 안 함"으로 되돌리면 프리필된 attendees/최대 인원을 초기 상태로
  되돌리지 않는다(사용자가 이미 값을 수동으로 조정했을 수 있으므로, 마지막에 적용된
  값을 그대로 둔다).

## 제출 시 처리

`postData.attendees`는 기존과 동일하게 uid 배열이다. 파티에서 온 것인지 여부를
구분하는 필드는 두지 않는다(파티-일정 간 참조가 없다는 원칙과 일관됨).

## 에러 처리

- 파티 생성/수정 시 이름이 비어있거나 멤버가 0명(본인 제외)이어도 저장은 허용한다 —
  혼자만의 파티도 유효한 사용(단독 반복 참가 기록용)으로 막을 이유가 없다.
- 파티 로드 실패(네트워크 오류)는 콘솔에 로그만 남기고 "내 파티 불러오기" 드롭다운을
  숨긴다 — 파티 기능 오류가 글쓰기 자체를 막지 않는다.

## 테스트

- 별도 순수 로직 모듈이 없어 단위 테스트 대상은 제한적이다. `party.js`에 멤버 배열
  중복 제거/본인 포함 보장 같은 순수 함수가 생기면 `party-logic.test.mjs`로 분리해
  테스트한다(예: 멤버 목록에 ownerUid가 없으면 자동 추가하는 로직).
