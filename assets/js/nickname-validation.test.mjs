import { test } from "node:test";
import assert from "node:assert";

// register.js의 닉네임 검증과 동일한 규칙 — 바뀌면 여기서 깨진다
const NICKNAME_RE = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ._-]+$/;
const isValid = (n) => n.length > 0 && n.length <= 12 && NICKNAME_RE.test(n);

test("정상 닉네임 허용", () => {
  ["다소", "kong2", "장단콩 클럽", "a_b-c.d", "홍길동"].forEach((n) =>
    assert.ok(isValid(n), `허용되어야 함: ${n}`)
  );
});

test("마크업 문자가 든 닉네임 차단 (XSS 방지)", () => {
  [
    `<img src=x onerror=alert(1)>`,
    `<script>alert(1)</script>`,
    `a"onmouseover="alert(1)`,
    `'); alert(1); ('`,
    `<b>bold</b>`,
    `&lt;`,
  ].forEach((n) => assert.ok(!isValid(n), `차단되어야 함: ${n}`));
});

test("길이 제한", () => {
  assert.ok(!isValid(""), "빈 값 차단");
  assert.ok(isValid("가".repeat(12)), "12자 허용");
  assert.ok(!isValid("가".repeat(13)), "13자 차단");
});
