function toDateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

function toDayKey(date) {
  const dt = new Date(date);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

export function computeVisitStats(events, uid) {
  const confirmedEvents = events.filter(
    (p) => p.type === "event" && !!p.closedAt && (p.confirmedAttendees || []).includes(uid)
  );

  const participatedSessions = confirmedEvents.length;

  const dayKeys = new Set(
    confirmedEvents
      .map((p) => toDateOrNull(p.eventDate))
      .filter((d) => d instanceof Date)
      .map(toDayKey)
  );

  return { visitDays: dayKeys.size, participatedSessions };
}
