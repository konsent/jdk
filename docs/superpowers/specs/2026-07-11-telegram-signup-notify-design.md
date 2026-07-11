# 가입 신청 텔레그램 알림 설계

## 배경

`register.js`는 사용자가 가입 신청을 제출하면 `users/{uid}` Firestore 문서를 `status: "pending"`으로 생성(또는 `rejected`/문서없음 상태에서 재신청 시 덮어쓰기)한다. 운영자는 `admin.html`을 직접 열어야만 새 신청을 확인할 수 있다. 신청이 들어오는 즉시 운영자 텔레그램 채팅방으로 알림을 보내 확인 지연을 없앤다.

이 사이트는 서버가 없는 정적 Jekyll 사이트이며, 클라이언트 JS만으로 텔레그램 봇 토�큰을 다루면 토큰이 공개 코드에 노출되므로, Firebase Cloud Functions를 서버리스 계층으로 신규 도입한다.

## 아키텍처

```
register.js (setDoc: users/{uid}, status="pending")
        │
        ▼  Firestore 문서 쓰기
Cloud Function: notifyOnPendingSignup
  (functions.firestore.document("users/{uid}").onWrite)
        │  변경 후 status === "pending" 이고
        │  변경 전 status !== "pending" 인 경우에만 실행
        ▼
Telegram Bot API: POST https://api.telegram.org/bot<TOKEN>/sendMessage
```

- 트리거: `onWrite` (onCreate가 아님 — 거절 후 재신청은 같은 uid 문서에 대한 업데이트이므로 onCreate로는 잡히지 않는다).
- 발동 조건: 함수 내부에서 `after.status === "pending" && before?.status !== "pending"`일 때만 텔레그램 메시지 전송. 승인/거절/강제탈퇴 등 다른 상태 전이에서는 전송하지 않는다.
- 메시지 내용: 닉네임, 이메일, admin 페이지 링크(`https://www.jdkclub.click/admin/`).
  예: `새 가입 신청: 홍길동 (hong@example.com)\nhttps://www.jdkclub.click/admin/`

## 인프라

- 신규 디렉터리 `functions/` (Node.js, Firebase Functions 2nd/1st gen — CLI 기본값 사용), `firebase.json`, `.firebaserc`를 저장소 루트에 추가.
- 봇 토큰과 chat ID는 Firebase Functions 환경설정(`firebase functions:secrets:set TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)으로 저장한다. 코드나 저장소에 평문으로 두지 않는다.
- Firebase 프로젝트(`jdk-member-board`)를 Blaze 요금제로 업그레이드해야 Cloud Functions를 배포할 수 있다. 이 알림 트래픽 규모(하루 소수 건)는 무료 할당량 내에서 처리되어 실질 과금은 발생하지 않는다.
- 배포: `firebase deploy --only functions`. Jekyll 정적 사이트 배포(GitHub Pages/CNAME)와는 독립적인 별도 배포 절차.

## 에러 처리

- 텔레그램 API 호출이 실패해도 Firestore 쓰기(가입 신청 자체)는 이미 완료된 뒤이므로 사용자 플로우에는 영향 없다.
- 함수 내에서 텔레그램 API 실패 시 예외를 잡아 Cloud Functions 로그에 기록하고 종료한다(재시도 없음).

## 범위 밖

- 승인/거절 결과를 신청자에게 알리는 기능은 포함하지 않는다(기존 admin.html 흐름 그대로).
- 텔레그램 봇 생성 및 chat ID 확인 절차는 사용자가 이미 보유하고 있어 이 스펙에 포함하지 않는다.
