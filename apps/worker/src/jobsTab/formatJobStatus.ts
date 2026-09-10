import type { JobStatus } from "@prizm/api";

const LABELS: Record<JobStatus, string> = {
  requested: "Requested",
  searching: "Searching",
  matched: "Matched",
  accepted: "Heading over",
  arrived: "Evaluating",
  quote_pending: "Quote sent",
  quote_accepted: "Ready to start",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
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
  // Neutral, not danger — a worker declining after evaluating is a
  // sanctioned outcome, not an alarm (see the design brief).
  declined: "neutral",
  disputed: "danger",
};

export function getStatusTone(status: JobStatus): StatusTone {
  return TONES[status];
}

/** Caption shown under the price on a job card. Deliberately not "Paid" —
 * mobile money isn't wired up yet, so this reflects agreement state, not
 * that money moved. */
export function getPriceCaption(status: JobStatus): string | null {
  if (status === "quote_pending") return "quoted";
  if (status === "quote_accepted" || status === "in_progress") return "agreed";
  if (status === "completed") return "confirmed";
  return null;
}
