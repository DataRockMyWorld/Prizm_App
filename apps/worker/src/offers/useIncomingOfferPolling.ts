import { getIncomingOffers, JobOffer } from "@prizm/api";
import { useEffect, useRef, useState } from "react";

export const DEFAULT_POLL_INTERVAL_MS = 5000;

export interface UseIncomingOfferPollingParams {
  accessToken: string | null;
  isOnline: boolean;
  intervalMs?: number;
}

/** Polls for a pending job offer while online, pausing while one is already
 * being shown — resume by calling `dismiss` once the worker has acted on it
 * (accepted, declined, or it expired). */
export function useIncomingOfferPolling({
  accessToken,
  isOnline,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseIncomingOfferPollingParams) {
  const [currentOffer, setCurrentOfferState] = useState<JobOffer | null>(null);
  // Mirrors currentOffer synchronously so an in-flight poll can't set a
  // second offer if it resolves in the brief window before React tears
  // down the interval in response to state changing.
  const currentOfferRef = useRef<JobOffer | null>(null);
  const isFetchingRef = useRef(false);

  const setCurrentOffer = (offer: JobOffer | null) => {
    currentOfferRef.current = offer;
    setCurrentOfferState(offer);
  };

  useEffect(() => {
    if (!accessToken || !isOnline || currentOffer) return undefined;

    const poll = async () => {
      if (isFetchingRef.current || currentOfferRef.current) return;
      isFetchingRef.current = true;
      try {
        const offers = await getIncomingOffers(accessToken);
        if (!currentOfferRef.current && offers.length > 0) {
          setCurrentOffer(offers[0]);
        }
      } catch {
        // transient network error — keep polling on the next tick
      } finally {
        isFetchingRef.current = false;
      }
    };

    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);
  }, [accessToken, isOnline, currentOffer, intervalMs]);

  const dismiss = () => setCurrentOffer(null);

  return { currentOffer, dismiss };
}
