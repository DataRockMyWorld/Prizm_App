import { getJob, JobRequest, JobStatus } from "@prizm/api";
import { useEffect, useRef, useState } from "react";

export const DEFAULT_POLL_INTERVAL_MS = 3000;

export type JobStatusBranch = "completed" | "disputed" | "other";

/** Which terminal branch a status falls into once the job moves off
 * awaiting_price_confirmation — null while still waiting. "other" is the
 * defensive fallback for anything unexpected (e.g. an admin-forced
 * cancelled), not just completed/disputed. */
export function getStatusBranch(status: JobStatus): JobStatusBranch | null {
  if (status === "awaiting_price_confirmation") return null;
  if (status === "completed") return "completed";
  if (status === "disputed") return "disputed";
  return "other";
}

export interface UseJobStatusPollingParams {
  accessToken: string | null;
  jobId: number;
  intervalMs?: number;
}

/** Polls a job while it's awaiting price confirmation, stopping as soon as
 * it reaches a terminal branch (mirrors the customer app's JobStatusScreen
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
