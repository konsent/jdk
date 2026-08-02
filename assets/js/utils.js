// 여러 페이지에서 공통으로 쓰는 헬퍼 모음.
// 페이지별로 흩어져 중복되던 escapeHtml / formatEventDate / showError 를 여기로 합쳤다.

/**
 * 문자열을 HTML 텍스트로 안전하게 이스케이프한다.
 * 속성값에 넣어도 안전하도록 따옴표를 둘 다 처리한다 —
 * 홑따옴표를 빼두면 attr='...' 로 쓴 곳 하나에서 바로 뚫린다.
 */
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Firestore Timestamp 를 "2026. 8. 1. 19:30" 형태로 렌더한다.
 * 시/분이 모두 0이면 날짜만 반환한다(시간 미지정 일정).
 */
export function formatEventDate(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const date = d.toLocaleDateString("ko-KR");
  const h = d.getHours(), m = d.getMinutes();
  return (h || m) ? `${date} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : date;
}

/**
 * 페이지 상단의 #msg-error 영역에 오류 메시지를 띄운다.
 */
export function showError(msg, elementId = "msg-error") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}
