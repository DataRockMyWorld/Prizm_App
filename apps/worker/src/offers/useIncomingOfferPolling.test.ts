import { getIncomingOffers, JobOffer } from "@prizm/api";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useIncomingOfferPolling } from "./useIncomingOfferPolling";

jest.mock("@prizm/api", () => ({ getIncomingOffers: jest.fn() }));

const mockGetIncomingOffers = getIncomingOffers as jest.Mock;
// Real timers with a short interval, rather than jest fake timers — simpler
// to get right with an async setInterval callback than juggling fake-timer
// advancement + microtask flushing. Each test unmounts its hook explicitly
// so no interval outlives the test.
const INTERVAL_MS = 20;

function makeOffer(id: number): JobOffer {
  return { id, job: {} as JobOffer["job"], offered_at: "", responds_by: "" };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  mockGetIncomingOffers.mockReset();
});

test("polls at the configured interval while online", async () => {
  mockGetIncomingOffers.mockResolvedValue([]);
  const { unmount } = await renderHook(() =>
    useIncomingOfferPolling({ accessToken: "tok", isOnline: true, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(mockGetIncomingOffers.mock.calls.length).toBeGreaterThanOrEqual(2));
  await unmount();
});

test("does not poll while offline", async () => {
  mockGetIncomingOffers.mockResolvedValue([]);
  const { unmount } = await renderHook(() =>
    useIncomingOfferPolling({ accessToken: "tok", isOnline: false, intervalMs: INTERVAL_MS })
  );
  await wait(INTERVAL_MS * 3);
  expect(mockGetIncomingOffers).not.toHaveBeenCalled();
  await unmount();
});

test("stops polling once an offer is set, resumes after dismiss", async () => {
  mockGetIncomingOffers.mockResolvedValue([makeOffer(1)]);
  const { result, unmount } = await renderHook(() =>
    useIncomingOfferPolling({ accessToken: "tok", isOnline: true, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(result.current.currentOffer?.id).toBe(1));
  const callsWhileShowingOffer = mockGetIncomingOffers.mock.calls.length;

  await wait(INTERVAL_MS * 3);
  expect(mockGetIncomingOffers.mock.calls.length).toBe(callsWhileShowingOffer);

  await act(async () => {
    result.current.dismiss();
  });
  expect(result.current.currentOffer).toBeNull();

  await waitFor(() =>
    expect(mockGetIncomingOffers.mock.calls.length).toBeGreaterThan(callsWhileShowingOffer)
  );
  await unmount();
});

test("does not start a second fetch while one is already in flight", async () => {
  let resolveFetch: ((offers: JobOffer[]) => void) | null = null;
  mockGetIncomingOffers.mockImplementation(
    () =>
      new Promise<JobOffer[]>((resolve) => {
        resolveFetch = resolve;
      })
  );

  const { unmount } = await renderHook(() =>
    useIncomingOfferPolling({ accessToken: "tok", isOnline: true, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(mockGetIncomingOffers).toHaveBeenCalledTimes(1));
  await wait(INTERVAL_MS * 3);
  // Still just the one in-flight fetch — the guard blocked further ticks.
  expect(mockGetIncomingOffers).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveFetch?.([makeOffer(1)]);
  });
  await unmount();
});
