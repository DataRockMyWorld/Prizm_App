import type { JobStatus } from "@prizm/api";

const LABELS: Record<JobStatus, string> = {
  requested: "Requested",
  searching: "Searching",
  matched: "Matched",
  accepted: "Accepted",
  arrived: "Assessing the job",
  quote_pending: "Confirm the price",
  quote_accepted: "About to start",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined by worker",
  disputed: "Disputed",
};

export function formatJobStatusLabel(status: JobStatus): string {
  return LABELS[status];
}

export type StatusTone = "active" | "waiting" | "success" | "danger" | "neutral";

const TONES: Record<JobStatus, StatusTone> = {
  requested: "neutral",
  searching: "neutral",
  matched: "neutral",
  accepted: "active",
  arrived: "active",
  quote_pending: "waiting",
  quote_accepted: "active",
  in_progress: "active",
  completed: "success",
  cancelled: "neutral",
  declined: "neutral",
  disputed: "danger",
};

export function getStatusTone(status: JobStatus): StatusTone {
  return TONES[status];
}
