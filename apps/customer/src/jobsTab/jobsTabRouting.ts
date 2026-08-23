import type { JobStatus } from "@prizm/api";

export type JobsTabRoute = "Searching" | "JobStatus" | "PriceAgreement" | "JobDetail";

const SEARCHING_STATUSES: JobStatus[] = ["requested", "searching"];
const TRACKING_STATUSES: JobStatus[] = [
  "matched",
  "accepted",
  "on_my_way",
  "arrived",
  "in_progress",
];

/** Which screen tapping a job in the Jobs tab should open — the real
 * live screen for anything still in progress (so leaving JobStatus isn't
 * a dead end), a read-only detail view once it's reached a terminal
 * state. "matched" routes straight to JobStatus rather than replaying
 * the one-time "you've been matched!" Matched screen — that's an intro
 * celebration, not something to show again on every re-entry. */
export function getJobsTabRoute(status: JobStatus): JobsTabRoute {
  if (SEARCHING_STATUSES.includes(status)) return "Searching";
  if (TRACKING_STATUSES.includes(status)) return "JobStatus";
  if (status === "awaiting_price_confirmation") return "PriceAgreement";
  return "JobDetail";
}
