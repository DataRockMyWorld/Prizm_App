import { listMessages, Message } from "@prizm/api";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useMessagePolling } from "./useMessagePolling";

jest.mock("@prizm/api", () => ({ listMessages: jest.fn() }));

const mockListMessages = listMessages as jest.Mock;
// Real timers with a short interval — same reasoning as the existing
// useJobStatusPolling tests (real intervals are simpler to get right than
// fake-timer advancement + microtask flushing in this RN Testing Library
// version).
const INTERVAL_MS = 20;

function makeMessage(id: number, text: string): Message {
  return {
    id,
    sender: { id: 2, full_name: "Sarah K.", photo: null },
    text,
    created_at: "2026-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  mockListMessages.mockReset();
});

test("polls immediately on mount and populates messages", async () => {
  mockListMessages.mockResolvedValue([makeMessage(1, "hi")]);
  const { result, unmount } = await renderHook(() =>
    useMessagePolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(result.current.messages).toHaveLength(1));
  expect(mockListMessages).toHaveBeenCalledWith("tok", 1);
  await unmount();
});

test("re-polls on an interval", async () => {
  mockListMessages.mockResolvedValue([]);
  const { unmount } = await renderHook(() =>
    useMessagePolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(mockListMessages.mock.calls.length).toBeGreaterThanOrEqual(2));
  await unmount();
});

test("stops polling on unmount", async () => {
  mockListMessages.mockResolvedValue([]);
  const { unmount } = await renderHook(() =>
    useMessagePolling({ accessToken: "tok", jobId: 1, intervalMs: INTERVAL_MS })
  );

  await waitFor(() => expect(mockListMessages.mock.calls.length).toBeGreaterThanOrEqual(1));
  await unmount();
  const callsAtUnmount = mockListMessages.mock.calls.length;

  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS * 3));
  expect(mockListMessages.mock.calls.length).toBe(callsAtUnmount);
});

test("refresh() triggers an immediate extra poll", async () => {
  mockListMessages.mockResolvedValue([]);
  const { result, unmount } = await renderHook(() =>
    useMessagePolling({ accessToken: "tok", jobId: 1, intervalMs: 10_000 })
  );

  await waitFor(() => expect(mockListMessages.mock.calls.length).toBeGreaterThanOrEqual(1));
  const callsBeforeRefresh = mockListMessages.mock.calls.length;

  await act(async () => {
    await result.current.refresh();
  });

  expect(mockListMessages.mock.calls.length).toBe(callsBeforeRefresh + 1);
  await unmount();
});

test("does not poll when accessToken is null", async () => {
  mockListMessages.mockResolvedValue([]);
  const { unmount } = await renderHook(() =>
    useMessagePolling({ accessToken: null, jobId: 1, intervalMs: INTERVAL_MS })
  );

  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS * 3));
  expect(mockListMessages).not.toHaveBeenCalled();
  await unmount();
});
