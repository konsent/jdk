export function normalizeMembers(ownerUid, memberUids) {
  const unique = [...new Set(memberUids)];
  if (!unique.includes(ownerUid)) unique.unshift(ownerUid);
  return unique;
}

export function filterByNickname(users, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return users.filter((u) => u.nickname.toLowerCase().includes(q));
}
