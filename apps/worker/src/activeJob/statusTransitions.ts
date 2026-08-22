import type { JobStatus } from "@prizm/api";

const STEPPER_ORDER: JobStatus[] = ["accepted", "on_my_way", "arrived", "in_progress"];

/** Next status in the worker's on-site stepper (accepted → on_my_way →
 * arrived → in_progress), or null if `current` isn't in that stepper or is
 * already at its end (in_progress → complete is a separate action). */
export function getNextValidStatus(current: JobStatus): JobStatus | null {
  const index = STEPPER_ORDER.indexOf(current);
  if (index === -1 || index === STEPPER_ORDER.length - 1) return null;
  return STEPPER_ORDER[index + 1];
}

const CANCEL_WINDOW_MS = 10 * 60 * 1000;

/** Whether the free worker-cancellation window (10 minutes from
 * `acceptedAt`) is still open. */
export function isCancelWindowOpen(acceptedAt: string | null, now: Date = new Date()): boolean {
  if (!acceptedAt) return false;
  return now.getTime() - new Date(acceptedAt).getTime() < CANCEL_WINDOW_MS;
}
