import type { JobStatus } from "@prizm/api";

export type JobsTabRoute = "ActiveJob" | "WaitingForConfirmation" | "JobDetail";

const ACTIVE_STATUSES: JobStatus[] = [
  "accepted",
  "arrived",
  "quote_accepted",
  "in_progress",
];

/** Which screen tapping a job in the history list should open — the real
 * live screen for anything still in progress (so leaving ActiveJob isn't
 * a dead end), the quote-wait screen while a quote is out for confirmation,
 * a read-only detail view once it's terminal. */
export function getJobsTabRoute(status: JobStatus): JobsTabRoute {
  if (ACTIVE_STATUSES.includes(status)) return "ActiveJob";
  if (status === "quote_pending") return "WaitingForConfirmation";
  return "JobDetail";
}
