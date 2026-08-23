import type { JobRequest } from "@prizm/api";

/** Newest-first by created_at. Array.prototype.sort is spec-guaranteed
 * stable, so equal timestamps keep their original relative order. */
export function sortJobsNewestFirst(jobs: JobRequest[]): JobRequest[] {
  return [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
