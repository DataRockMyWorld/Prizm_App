import { getJob, JobRequest, JobStatus } from "@prizm/api";
import { useEffect, useRef, useState } from "react";

export const DEFAULT_POLL_INTERVAL_MS = 3000;

/** Where a job goes once it leaves `quote_pending`:
 *  - "quote_accepted" — customer confirmed; the worker can start
 *  - "rejected"       — customer rejected the quote (job → cancelled)
 *  - "other"          — any other unexpected move (admin action, etc.)
 * null while still waiting on the customer. */
export type JobStatusBranch = "quote_accepted" | "rejected" | "other";

export function getStatusBranch(status: JobStatus): JobStatusBranch | null {
  if (status === "quote_pending") return null;
  if (status === "quote_accepted") return "quote_accepted";
  if (status === "cancelled") return "rejected";
  return "other";
}

export interface UseJobStatusPollingParams {
  accessToken: string | null;
  jobId: number;
  intervalMs?: number;
}

/** Polls a job while it's `quote_pending`, stopping as soon as the customer
 * confirms or rejects the quote (mirrors the customer app's JobStatusScreen
 * polling pattern). */
export function useJobStatusPolling({
  accessToken,
  jobId,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseJobStatusPollingParams) {
  const [job, setJob] = useState<JobRequest | null>(null);
  const [branch, setBranch] = useState<JobStatusBranch | null>(null);
  // Mirrors `branch` synchronously so a poll already in flight can't set a
  // second branch after one has already been reached.
  const branchRef = useRef<JobStatusBranch | null>(null);

  useEffect(() => {
    if (!accessToken) return undefined;

    const poll = async () => {
      if (branchRef.current) return;
      try {
        const data = await getJob(accessToken, jobId);
        if (branchRef.current) return;
        setJob(data);
        const nextBranch = getStatusBranch(data.status);
        if (nextBranch) {
          branchRef.current = nextBranch;
          setBranch(nextBranch);
        }
      } catch {
        // transient poll failure — try again next tick
      }
    };

    poll();
    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);
  }, [accessToken, jobId, intervalMs]);

  return { job, branch };
}
