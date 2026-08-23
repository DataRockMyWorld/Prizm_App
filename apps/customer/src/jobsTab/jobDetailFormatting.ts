const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "20 Aug 2026 · 14:20" */
export function formatFullDateTime(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = MONTH_LABELS[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} · ${hours}:${minutes}`;
}

/** "3h 10m" from acceptance to completion — the best proxy we have for how
 * long a job took, since there's no separate "work started" timestamp.
 * Null if either end is missing/invalid, rather than showing a bogus
 * duration. */
export function computeJobDuration(acceptedAt: string | null, completedAt: string): string | null {
  if (!acceptedAt) return null;
  const startMs = new Date(acceptedAt).getTime();
  const endMs = new Date(completedAt).getTime();
  const durationMs = endMs - startMs;
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;

  const totalMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
