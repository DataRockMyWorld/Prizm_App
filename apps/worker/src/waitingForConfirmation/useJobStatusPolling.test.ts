import { getJob, JobRequest } from "@prizm/api";
import { renderHook, waitFor } from "@testing-library/react-native";

import { getStatusBranch, useJobStatusPolling } from "./useJobStatusPolling";

jest.mock("@prizm/api", () => ({ getJob: jest.fn() }));

const mockGetJob = getJob as jest.Mock;
// Real timers with a short interval — same reasoning as T3's polling hook
// tests (renderHook/act/unmount are all async in this RN Testing Library
// version, and real intervals are simpler to get right than fake-timer
// advancement + microtask flushing).
const INTERVAL_MS = 20;

function makeJob(status: JobRequest["status"]): JobRequest {
  return {
    id: 1,
    category: { id: 1, name: "Cleaning", slug: "cleaning", estimate_min: "150", estimate_max: "300" },
    description: "",
    address: "",
    latitude: null,
    longitude: null,
    photo: null,
    status,
    price_range_min: "150",
    price_range_max: "300",
    agreed_price: "220",
    worker_note: "",
    customer: { id: 2, full_name: "Sarah K.", photo: null },
    worker: null,
    current_offer_responds_by: null,
    accepted_at: null,
    rating: null,
    created_at: "",
    updated_at: "",
  };
}

beforeEach(() => {
  mockGetJob.mockReset();
});

test("getStatusBranch classifies each status correctly", () => {
  expect(getStatusBranch("awaiting_price_confirmation")).toBeNull();
  expect(getStatusBranch("completed")).toBe("completed");
  expect(getStatusBranch("disputed")).toBe("disputed");
  expect(getStatusBranch("cancelled")).toBe("other");
  expect(getStatusBranch("accepted")).toBe("other");
});

test("stops polling once a terminal branch is reached, on unmount", async () => {
  mockGetJob.mockResolvedValue(makeJob("awaiting_price_confirmation"));
  const { unmount } = await renderHook(() =>
    useJobStatusPolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(mockGetJob.mock.calls.length).toBeGreaterThanOrEqual(2));
  await unmount();
  const callsAtUnmount = mockGetJob.mock.calls.length;

  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS * 3));
  expect(mockGetJob.mock.calls.length).toBe(callsAtUnmount);
});

test("reaching completed stops polling and sets the branch exactly once", async () => {
  mockGetJob.mockResolvedValue(makeJob("completed"));
  const { result, unmount } = await renderHook(() =>
    useJobStatusPolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(result.current.branch).toBe("completed"));
  const callsAtBranch = mockGetJob.mock.calls.length;

  // A stray poll response after the branch is reached shouldn't re-trigger
  // anything or keep polling.
  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS * 3));
  expect(mockGetJob.mock.calls.length).toBe(callsAtBranch);
  expect(result.current.branch).toBe("completed");
  await unmount();
});

test("reaching disputed sets the disputed branch, not completed", async () => {
  mockGetJob.mockResolvedValue(makeJob("disputed"));
  const { result, unmount } = await renderHook(() =>
    useJobStatusPolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(result.current.branch).toBe("disputed"));
  await unmount();
});

test("an unexpected status falls back to the 'other' branch instead of looping", async () => {
  mockGetJob.mockResolvedValue(makeJob("cancelled"));
  const { result, unmount } = await renderHook(() =>
    useJobStatusPolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(result.current.branch).toBe("other"));
  await unmount();
});
