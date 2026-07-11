# 비밀번호 찾기(재설정) 기능 설계

## 배경

`login.html`/`assets/js/login.js`는 이메일+비밀번호 로그인을 지원하지만 비밀번호를 잊었을 때 복구할 방법이 없다. Firebase Authentication은 `sendPasswordResetEmail`이라는 내장 함수를 제공하며, 이는 서버/이메일 인프라 없이 클라이언트에서 바로 호출 가능하다 (Cloud Functions 불필요).

## 흐름

1. `login.html`에 "비밀번호를 잊으셨나요?" 링크를 추가한다.
2. 클릭 시 작은 모달이 뜬다 (admin.js의 기존 확인모달과 유사한 패턴) — 이메일 입력 필드 1개 + 발송 버튼.
3. 발송 버튼 클릭 시 `sendPasswordResetEmail(auth, email)`을 호출한다.
4. 결과와 무관하게 (계정 존재 여부를 노출하지 않기 위해) 항상 동일한 안내 메시지를 보여준다: "입력하신 이메일로 재설정 링크를 보냈습니다. 계정이 존재하지 않는 경우 메일이 오지 않을 수 있습니다."
   - 예외: `auth/invalid-email` 등 순수 입력 형식 오류는 계정 존재 여부와 무관하므로 그대로 사용자에게 표시한다.
5. 사용자는 Firebase가 발송한 기본 이메일의 링크를 클릭 → Firebase 기본 제공 비밀번호 재설정 페이지(`https://jdk-member-board.firebaseapp.com/__/auth/action`)에서 새 비밀번호를 입력 → 완료.

## 보안 확인

`sendPasswordResetEmail`은 이메일로 재설정 링크만 발송하며 그 자체로 비밀번호를 변경하지 않는다. 실제 변경은 해당 이메일의 받은편지함에 접근 가능한 사람이 링크를 클릭하고 새 비밀번호를 입력해야만 완료된다. 따라서 타인의 이메일 주소로 재설정을 요청해도 계정은 안전하다 — Firebase Auth의 표준 동작이며 별도 방지 로직이 필요 없다.

## 대상 계정

승인 상태(pending/approved/rejected)와 무관하게, Firebase Auth 계정만 존재하면 재설정이 가능하다. `sendPasswordResetEmail`은 Firestore의 승인 상태를 전혀 참조하지 않는 별개 시스템이므로, 상태별로 막으려면 오히려 불필요한 조회/분기 로직이 추가된다.

## 변경 파일

- `login.html` — "비밀번호를 잊으셨나요?" 링크와 모달 마크업 추가
- `assets/js/login.js` — 모달 열기/닫기, `sendPasswordResetEmail` 호출 및 결과 메시지 처리 로직 추가
- Cloud Functions/서버 변경 없음 — Firebase Auth 내장 기능만 사용

## 범위 밖

- 재설정 이메일 템플릿(발신자명, 문구 등) 커스터마이징 — Firebase 콘솔에서 별도로 설정하는 항목이라 이 스펙에서 다루지 않는다.
- 재설정 완료 후 랜딩 페이지 커스터마이징(Firebase 기본 페이지 대신 자체 페이지) — 이후 필요 시 별도 작업으로 진행한다.
