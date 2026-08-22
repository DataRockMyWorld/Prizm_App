import { ApiError } from "./client";
import {
  acceptOffer,
  cancelJobAsWorker,
  completeJob,
  declineOffer,
  getIncomingOffers,
  markArrived,
  markInProgress,
  markOnMyWay,
} from "./jobs";

function mockFetchOnce(body: unknown, status = 200) {
  const mockFetch = global.fetch as jest.Mock;
  mockFetch.mockClear();
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

function lastCall() {
  const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
  return { url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

test("getIncomingOffers calls GET /api/jobs/worker/incoming/", async () => {
  mockFetchOnce([]);
  await getIncomingOffers("tok");
  const { url, method } = lastCall();
  expect(url).toContain("/api/jobs/worker/incoming/");
  expect(method).toBe("GET");
});

test("acceptOffer calls POST /api/jobs/offers/<id>/accept/", async () => {
  mockFetchOnce({ id: 1 });
  await acceptOffer("tok", 42);
  const { url, method } = lastCall();
  expect(url).toContain("/api/jobs/offers/42/accept/");
  expect(method).toBe("POST");
});

test("declineOffer calls POST /api/jobs/offers/<id>/decline/", async () => {
  mockFetchOnce({ detail: "Offer declined." });
  await declineOffer("tok", 42);
  const { url, method } = lastCall();
  expect(url).toContain("/api/jobs/offers/42/decline/");
  expect(method).toBe("POST");
});

test("markOnMyWay calls POST /api/jobs/<id>/on-my-way/", async () => {
  mockFetchOnce({});
  await markOnMyWay("tok", 7);
  const { url, method } = lastCall();
  expect(url).toContain("/api/jobs/7/on-my-way/");
  expect(method).toBe("POST");
});

test("markArrived calls POST /api/jobs/<id>/arrived/", async () => {
  mockFetchOnce({});
  await markArrived("tok", 7);
  const { url, method } = lastCall();
  expect(url).toContain("/api/jobs/7/arrived/");
  expect(method).toBe("POST");
});

test("markInProgress calls POST /api/jobs/<id>/start/", async () => {
  mockFetchOnce({});
  await markInProgress("tok", 7);
  const { url, method } = lastCall();
  expect(url).toContain("/api/jobs/7/start/");
  expect(method).toBe("POST");
});

test("completeJob sends agreed_price and note", async () => {
  mockFetchOnce({});
  await completeJob("tok", 7, 220, "Deep cleaned kitchen");
  const { url, method, body } = lastCall();
  expect(url).toContain("/api/jobs/7/complete/");
  expect(method).toBe("POST");
  expect(body).toEqual({ agreed_price: 220, note: "Deep cleaned kitchen" });
});

test("completeJob omits note as empty string, not undefined", async () => {
  mockFetchOnce({});
  await completeJob("tok", 7, 220);
  const { body } = lastCall();
  expect(body).toEqual({ agreed_price: 220, note: "" });
});

test("cancelJobAsWorker sends reason and note", async () => {
  mockFetchOnce({});
  await cancelJobAsWorker("tok", 7, "transport_issue", "Flat tire on the way");
  const { url, method, body } = lastCall();
  expect(url).toContain("/api/jobs/7/cancel/");
  expect(method).toBe("POST");
  expect(body).toEqual({ reason: "transport_issue", note: "Flat tire on the way" });
});

test("cancelJobAsWorker omits note as empty string, not undefined", async () => {
  mockFetchOnce({});
  await cancelJobAsWorker("tok", 7, "other");
  const { body } = lastCall();
  expect(body).toEqual({ reason: "other", note: "" });
});

test("a non-2xx response rejects with ApiError", async () => {
  mockFetchOnce({ detail: "Not your job." }, 403);
  await expect(markOnMyWay("tok", 7)).rejects.toBeInstanceOf(ApiError);
});
