import type { JobStatus } from "@prizm/api";

const LABELS: Record<JobStatus, string> = {
  requested: "Requested",
  searching: "Searching",
  matched: "Matched",
  accepted: "Accepted",
  on_my_way: "On my way",
  arrived: "Arrived",
  in_progress: "In progress",
  awaiting_price_confirmation: "Awaiting confirmation",
  completed: "Completed",
  cancelled: "Cancelled",
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
  on_my_way: "active",
  arrived: "active",
  in_progress: "active",
  awaiting_price_confirmation: "waiting",
  completed: "success",
  cancelled: "neutral",
  disputed: "danger",
};

export function getStatusTone(status: JobStatus): StatusTone {
  return TONES[status];
}
