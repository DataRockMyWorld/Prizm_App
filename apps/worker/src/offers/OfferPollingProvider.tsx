import { getWorkerStatus, JobOffer, useAuth } from "@prizm/api";
import React, { createContext, useContext, useEffect, useState } from "react";

import { navigationRef } from "../navigation/navigationRef";
import { useIncomingOfferPolling } from "./useIncomingOfferPolling";

const STATUS_CHECK_INTERVAL_MS = 10000;

interface OfferPollingContextValue {
  currentOffer: JobOffer | null;
  dismiss: () => void;
}

const OfferPollingContext = createContext<OfferPollingContextValue | undefined>(undefined);

/** Mounted once above the root stack. Tracks the worker's online status
 * (independent of HomeScreen's own copy — this needs to work regardless of
 * which tab is active) and, while online, polls for a pending offer and
 * navigates to the full-screen interrupt as soon as one appears. */
export function OfferPollingProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!accessToken) return undefined;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const status = await getWorkerStatus(accessToken);
        if (!cancelled) setIsOnline(status.is_online);
      } catch {
        // leave isOnline as-is until the next successful check
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, STATUS_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken]);

  const { currentOffer, dismiss } = useIncomingOfferPolling({ accessToken, isOnline });

  useEffect(() => {
    if (currentOffer && navigationRef.isReady()) {
      navigationRef.navigate("IncomingOffer");
    }
  }, [currentOffer]);

  return (
    <OfferPollingContext.Provider value={{ currentOffer, dismiss }}>
      {children}
    </OfferPollingContext.Provider>
  );
}

export function useOfferPolling() {
  const ctx = useContext(OfferPollingContext);
  if (!ctx) {
    throw new Error("useOfferPolling must be used within OfferPollingProvider");
  }
  return ctx;
}
