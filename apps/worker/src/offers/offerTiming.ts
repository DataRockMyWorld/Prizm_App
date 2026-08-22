/** Seconds remaining until `respondsBy` (an ISO timestamp), floored at 0
 * rather than going negative once the offer has expired. */
export function computeRemainingSeconds(respondsBy: string, now: Date = new Date()): number {
  const remainingMs = new Date(respondsBy).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/** "1:00" style mm:ss display for a countdown, matching the W1 mockup. */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
