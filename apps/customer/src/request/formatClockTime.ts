/** "2026-09-04T14:08:17.403Z" -> "2:08 PM" — used for the job-status
 * timeline's per-step timestamps. */
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
