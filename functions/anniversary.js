const FOUNDATION_YEAR = 2023;
const ANNIVERSARY_MONTH = 5;
const ANNIVERSARY_DAY = 23;

function getSeoulDateParts(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)])
  );
  return { year: values.year, month: values.month, day: values.day };
}

function shouldCreateAnniversary({ month, day }) {
  return month > ANNIVERSARY_MONTH || (month === ANNIVERSARY_MONTH && day >= ANNIVERSARY_DAY);
}

function anniversaryPostId(year) {
  return `anniversary-${year}`;
}

function buildAnniversaryPost(year, eventDate) {
  return {
    type: "event", isAnniversary: true, authorUid: "system", authorName: "시스템",
    title: `장단콩 클럽 ${year - FOUNDATION_YEAR}주년 기념일 🎉`, content: "", eventDate,
    maxAttendees: 20, attendees: [], games: []
  };
}

module.exports = {
  getSeoulDateParts,
  shouldCreateAnniversary,
  anniversaryPostId,
  buildAnniversaryPost
};
