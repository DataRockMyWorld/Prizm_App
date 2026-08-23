import type { JobRequest, JobStatus } from "@prizm/api";

/** Which Jobs-tab bucket a status belongs in — "active" is everything
 * still in flight for the worker, including waiting on the customer to
 * confirm a proposed price; "completed" is everything no longer
 * actionable (completed, disputed). */
export function isActiveJobStatus(status: JobStatus): boolean {
  return (
    status === "accepted" ||
    status === "on_my_way" ||
    status === "arrived" ||
    status === "in_progress" ||
    status === "awaiting_price_confirmation"
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

/** Sum of agreed_price across completed jobs created in the same
 * calendar month/year as `now`. Deliberately not called "earnings" —
 * mobile money isn't wired up yet, so this is what's been agreed, not
 * confirmed as paid. */
export function computeAgreedTotalThisMonth(jobs: JobRequest[], now: Date = new Date()): number {
  return jobs
    .filter((job) => {
      if (job.status !== "completed" || !job.agreed_price) return false;
      const created = new Date(job.created_at);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    })
    .reduce((sum, job) => sum + Number(job.agreed_price), 0);
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
