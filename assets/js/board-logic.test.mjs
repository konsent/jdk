import assert from "node:assert";
import { test } from "node:test";
import { displayEvents } from "./board-logic.js";

test("displayEvents: 창립기념일 일정을 게시판에 포함한다", () => {
  const anniversary = { id: "anniversary-2027", type: "event", isAnniversary: true };

  assert.deepStrictEqual(displayEvents([anniversary]), [anniversary]);
});
