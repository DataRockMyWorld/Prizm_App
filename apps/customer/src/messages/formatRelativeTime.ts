/** "Just now" / "5m ago" / "3h ago" / "Yesterday" / "Aug 20" (or "Aug 20,
 * 2025" if not the current year) — the Messages inbox row's timestamp.
 * Bucket boundaries (all exclusive of the next bucket up): <60s "Just
 * now", <60m "Xm ago", <24h "Xh ago", exactly 1 day "Yesterday", 2+ days
 * a short date. */
export function formatRelativeTime(dateString: string, now: Date): string {
  const date = new Date(dateString);
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) return "Just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return sameYear ? `${month} ${day}` : `${month} ${day}, ${date.getFullYear()}`;
}
