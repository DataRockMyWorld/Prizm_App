import type { JobRequest, JobStatus } from "@prizm/api";

/** Which Jobs-tab bucket a status belongs in — "active" is everything
 * still in flight for the customer, from the moment a request is
 * submitted (before a worker is even assigned) through waiting on a
 * proposed price; "completed" is everything terminal (completed,
 * cancelled, disputed). Unlike the worker app's version, this includes
 * the pre-match statuses (requested/searching/matched) — the customer
 * is tracking the job from submission, not from acceptance. */
export function isActiveJobStatus(status: JobStatus): boolean {
  return (
    status !== "completed" &&
    status !== "cancelled" &&
    status !== "declined" &&
    status !== "disputed"
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface RecencyGroups {
  thisWeek: JobRequest[];
  earlier: JobRequest[];
}

/** Splits already newest-first-sorted jobs into "this week" (within the
 * last 7 days of `now`) and "earlier" buckets. */
export function groupByRecency(jobs: JobRequest[], now: Date = new Date()): RecencyGroups {
  const thisWeek: JobRequest[] = [];
  const earlier: JobRequest[] = [];
  for (const job of jobs) {
    const age = now.getTime() - new Date(job.created_at).getTime();
    (age < WEEK_MS ? thisWeek : earlier).push(job);
  }
  return { thisWeek, earlier };
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Today · 09:30" if the date is today, otherwise "20 Aug". */
export function formatJobCardDate(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString);
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `Today · ${hours}:${minutes}`;
  }
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
}
