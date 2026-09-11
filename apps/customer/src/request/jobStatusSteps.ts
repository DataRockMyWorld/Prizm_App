import type { JobRequest, JobStatus } from "@prizm/api";

import { formatClockTime } from "./formatClockTime";

/** The customer's job-status timeline (v2 flow —
 * docs/prds/active-job-flow-v2.md). Six steps; "on my way" was dropped and
 * a "Price agreed" step added between arrival and the work. */
export const STEP_LABELS = [
  "Requested",
  "Accepted",
  "Arrived",
  "Price agreed",
  "In progress",
  "Complete",
] as const;

export interface TimelineState {
  /** Index of the last step that's actually *done* (ticked). */
  lastDone: number;
  /** Index of the step in focus — gets the accent ring + drives the
   * "N OF 6" count. Equals lastDone except at `quote_pending`, where the
   * work is done up to "Arrived" but "Price agreed" is the active ask. */
  current: number;
}

export function timelineState(status: JobStatus): TimelineState {
  switch (status) {
    case "accepted":
      return { lastDone: 1, current: 1 };
    case "arrived":
      return { lastDone: 2, current: 2 };
    case "quote_pending":
      return { lastDone: 2, current: 3 };
    case "quote_accepted":
      return { lastDone: 3, current: 3 };
    case "in_progress":
      return { lastDone: 4, current: 4 };
    case "completed":
      return { lastDone: 5, current: 5 };
    default:
      // requested / searching / matched — nothing past the request itself
      return { lastDone: 0, current: 0 };
  }
}

export function headlineForStatus(status: JobStatus, name: string): string {
  switch (status) {
    case "accepted":
      return `${name} is on the way`;
    case "arrived":
      return `${name} is assessing the job`;
    case "quote_pending":
      return `Confirm ${name}'s price to get started`;
    case "quote_accepted":
      return `${name} is about to start`;
    case "in_progress":
      return `${name} is working`;
    case "completed":
      return "Job complete";
    default:
      return `Waiting for ${name} to accept`;
  }
}

/** The clock time backing each step, in STEP_LABELS order. "Price agreed"
 * uses `quote_accepted_at`; "Complete" has no dedicated field (the beat
 * before Rating is too brief to need one). */
export function timestampForStep(index: number, job: JobRequest): string | null {
  const isoByIndex = [
    job.created_at,
    job.accepted_at,
    job.arrived_at,
    job.quote_accepted_at,
    job.started_at,
    null,
  ];
  const iso = isoByIndex[index];
  return iso ? formatClockTime(iso) : null;
}
