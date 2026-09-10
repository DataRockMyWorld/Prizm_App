import type { JobStatus } from "@prizm/api";

/** The four states ActiveJobScreen renders directly (v2 flow —
 * docs/prds/active-job-flow-v2.md):
 *  - heading_there  (accepted)      → "I've arrived"
 *  - evaluate       (arrived)       → "Accept & send quote" / "Decline this job"
 *  - ready_to_start (quote_accepted)→ "Start work"
 *  - in_progress    (in_progress)   → "Complete job"
 * quote_pending is handled by WaitingForConfirmationScreen, not here. */
export type ActiveJobPhase = "heading_there" | "evaluate" | "ready_to_start" | "in_progress";

export function activeJobPhase(status: JobStatus): ActiveJobPhase | null {
  switch (status) {
    case "accepted":
      return "heading_there";
    case "arrived":
      return "evaluate";
    case "quote_accepted":
      return "ready_to_start";
    case "in_progress":
      return "in_progress";
    default:
      return null;
  }
}

const CANCEL_WINDOW_MS = 10 * 60 * 1000;

/** Whether the free worker-cancellation window (10 minutes from
 * `acceptedAt`) is still open. Only relevant in the `heading_there` phase —
 * once the worker has arrived, the exit is Decline, not cancel. */
export function isCancelWindowOpen(acceptedAt: string | null, now: Date = new Date()): boolean {
  if (!acceptedAt) return false;
  return now.getTime() - new Date(acceptedAt).getTime() < CANCEL_WINDOW_MS;
}
