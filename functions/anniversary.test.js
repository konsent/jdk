const { test } = require("node:test");
const assert = require("node:assert");
const { shouldCreateAnniversary, anniversaryPostId, buildAnniversaryPost } = require("./anniversary.js");

test("shouldCreateAnniversary: 5월 22일 전에는 false이고 5월 23일부터 true", () => {
  assert.strictEqual(shouldCreateAnniversary({ year: 2026, month: 5, day: 22 }), false);
  assert.strictEqual(shouldCreateAnniversary({ year: 2026, month: 5, day: 23 }), true);
  assert.strictEqual(shouldCreateAnniversary({ year: 2026, month: 7, day: 27 }), true);
});

test("buildAnniversaryPost: 시스템 작성자·20명 정원·3주년 제목을 만든다", () => {
  const eventDate = new Date("2026-05-22T15:00:00.000Z");
  assert.deepStrictEqual(buildAnniversaryPost(2026, eventDate), {
    type: "event", isAnniversary: true, authorUid: "system", authorName: "시스템",
    title: "장단콩 클럽 3주년 기념일 🎉", content: "", eventDate,
    maxAttendees: 20, attendees: [], games: []
  });
  assert.strictEqual(anniversaryPostId(2026), "anniversary-2026");
});
