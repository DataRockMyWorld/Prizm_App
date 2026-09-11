import { getJob, JobRequest } from "@prizm/api";
import { renderHook, waitFor } from "@testing-library/react-native";

import { getStatusBranch, useJobStatusPolling } from "./useJobStatusPolling";

jest.mock("@prizm/api", () => ({ getJob: jest.fn() }));

const mockGetJob = getJob as jest.Mock;
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
    arrived_at: null,
    quoted_at: null,
    quote_accepted_at: null,
    started_at: null,
    rating: null,
    last_message: null,
    decline_reason: null,
    created_at: "",
    updated_at: "",
  };
}

beforeEach(() => {
  mockGetJob.mockReset();
});

test("getStatusBranch classifies each status correctly", () => {
  expect(getStatusBranch("quote_pending")).toBeNull();
  expect(getStatusBranch("quote_accepted")).toBe("quote_accepted");
  expect(getStatusBranch("cancelled")).toBe("rejected");
  expect(getStatusBranch("declined")).toBe("other");
  expect(getStatusBranch("in_progress")).toBe("other");
});

test("stops polling once a branch is reached, on unmount", async () => {
  mockGetJob.mockResolvedValue(makeJob("quote_pending"));
  const { unmount } = await renderHook(() =>
    useJobStatusPolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(mockGetJob.mock.calls.length).toBeGreaterThanOrEqual(2));
  await unmount();
  const callsAtUnmount = mockGetJob.mock.calls.length;

  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS * 3));
  expect(mockGetJob.mock.calls.length).toBe(callsAtUnmount);
});

test("reaching quote_accepted stops polling and sets the branch exactly once", async () => {
  mockGetJob.mockResolvedValue(makeJob("quote_accepted"));
  const { result, unmount } = await renderHook(() =>
    useJobStatusPolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(result.current.branch).toBe("quote_accepted"));
  const callsAtBranch = mockGetJob.mock.calls.length;

  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS * 3));
  expect(mockGetJob.mock.calls.length).toBe(callsAtBranch);
  expect(result.current.branch).toBe("quote_accepted");
  await unmount();
});

test("a rejected quote (cancelled) surfaces the 'rejected' branch, not 'other'", async () => {
  mockGetJob.mockResolvedValue(makeJob("cancelled"));
  const { result, unmount } = await renderHook(() =>
    useJobStatusPolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(result.current.branch).toBe("rejected"));
  await unmount();
});

test("an unexpected status falls back to the 'other' branch instead of looping", async () => {
  mockGetJob.mockResolvedValue(makeJob("disputed"));
  const { result, unmount } = await renderHook(() =>
    useJobStatusPolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(result.current.branch).toBe("other"));
  await unmount();
});
