import type { JobStatus } from "@prizm/api";

export type JobsTabRoute = "Searching" | "JobStatus" | "ConfirmQuote" | "JobDetail";

const SEARCHING_STATUSES: JobStatus[] = ["requested", "searching"];
const TRACKING_STATUSES: JobStatus[] = [
  "matched",
  "accepted",
  "arrived",
  "quote_accepted",
  "in_progress",
];

/** Which screen tapping a job in the Jobs tab should open — the real
 * live screen for anything still in progress (so leaving JobStatus isn't
 * a dead end), the quote-confirm screen while a quote is awaiting the
 * customer, a read-only detail view once it's terminal. "matched" routes
 * straight to JobStatus rather than replaying the one-time "you've been
 * matched!" screen. */
export function getJobsTabRoute(status: JobStatus): JobsTabRoute {
  if (SEARCHING_STATUSES.includes(status)) return "Searching";
  if (TRACKING_STATUSES.includes(status)) return "JobStatus";
  if (status === "quote_pending") return "ConfirmQuote";
  return "JobDetail";
}
