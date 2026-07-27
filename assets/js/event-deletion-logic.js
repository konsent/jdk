export function nextEventPostCount(currentPostCount) {
  if (!Number.isInteger(currentPostCount) || currentPostCount <= 0) return 0;
  return currentPostCount - 1;
}

export function shouldAdjustEventPostCount(post) {
  return post?.type === "event" && post.isAnniversary !== true && !!post.authorUid;
}
