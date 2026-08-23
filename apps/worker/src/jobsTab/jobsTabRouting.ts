import type { JobStatus } from "@prizm/api";

export type JobsTabRoute = "ActiveJob" | "WaitingForConfirmation" | "JobDetail";

const ACTIVE_STATUSES: JobStatus[] = ["accepted", "on_my_way", "arrived", "in_progress"];

/** Which screen tapping a job in the history list should open — the real
 * live screen for anything still in progress (so leaving ActiveJob isn't
 * a dead end), a read-only detail view once it's reached a terminal-ish
 * state. */
export function getJobsTabRoute(status: JobStatus): JobsTabRoute {
  if (ACTIVE_STATUSES.includes(status)) return "ActiveJob";
  if (status === "awaiting_price_confirmation") return "WaitingForConfirmation";
  return "JobDetail";
}
