/** "Posted X ago" copy for the read-only job preview screen. `now` is
 * injectable (defaults to the real clock) so this stays unit-testable
 * without faking global time. */
export function formatPostedAgo(dateString: string, now: Date = new Date()): string {
  const posted = new Date(dateString);
  const diffMinutes = Math.max(0, Math.round((now.getTime() - posted.getTime()) / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
