import { listMessages, Message } from "@prizm/api";
import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_POLL_INTERVAL_MS = 3000;

export interface UseMessagePollingParams {
  accessToken: string | null;
  jobId: number;
  intervalMs?: number;
}

/** Polls a job's chat thread while the screen is mounted — mirrors
 * useJobStatusPolling's shape (immediate poll + setInterval, in-flight
 * guard, cleanup on unmount). Not shared with the customer app's own
 * copy, per this codebase's existing per-app polling-hook convention. */
export function useMessagePolling({
  accessToken,
  jobId,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseMessagePollingParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const isFetchingRef = useRef(false);

  const poll = useCallback(async () => {
    if (!accessToken || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await listMessages(accessToken, jobId);
      setMessages(data);
    } catch {
      // transient poll failure — try again next tick
    } finally {
      isFetchingRef.current = false;
    }
  }, [accessToken, jobId]);

  useEffect(() => {
    if (!accessToken) return undefined;
    poll();
    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);
  }, [accessToken, jobId, intervalMs, poll]);

  return { messages, refresh: poll };
}
