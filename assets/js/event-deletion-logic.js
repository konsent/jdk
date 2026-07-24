export function nextEventPostCount(currentPostCount) {
  if (!Number.isInteger(currentPostCount) || currentPostCount <= 0) return 0;
  return currentPostCount - 1;
}
