import type { JobRequest } from "@prizm/api";

/** Most-recently-active thread first — a job's own `updated_at` when it
 * has no messages yet (so a freshly-assigned worker with zero messages
 * still sorts by when the match happened, not always to the bottom). */
export function sortThreadsByRecency(jobs: JobRequest[]): JobRequest[] {
  const activityTime = (job: JobRequest) =>
    new Date(job.last_message?.created_at ?? job.updated_at).getTime();
  return [...jobs].sort((a, b) => activityTime(b) - activityTime(a));
}
