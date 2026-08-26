import { getNotificationRoute, registerDevice, unregisterDevice } from "./notifications";

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

test("registerDevice calls POST /api/notifications/register-device/ with token + platform", async () => {
  mockFetchOnce(null);
  await registerDevice("auth-tok", "ExponentPushToken[abc]", "ios");
  const { url, method, body } = lastCall();
  expect(url).toContain("/api/notifications/register-device/");
  expect(method).toBe("POST");
  expect(body).toEqual({ token: "ExponentPushToken[abc]", platform: "ios" });
});

test("unregisterDevice calls DELETE /api/notifications/register-device/ with token", async () => {
  mockFetchOnce(null, 204);
  await unregisterDevice("auth-tok", "ExponentPushToken[abc]");
  const { url, method, body } = lastCall();
  expect(url).toContain("/api/notifications/register-device/");
  expect(method).toBe("DELETE");
  expect(body).toEqual({ token: "ExponentPushToken[abc]" });
});

describe("getNotificationRoute", () => {
  test("job_offer returns null — tapping just needs to foreground the app", () => {
    expect(getNotificationRoute({ type: "job_offer", job_id: 1 })).toBeNull();
  });

  test("job_accepted routes to JobStatus", () => {
    expect(getNotificationRoute({ type: "job_accepted", job_id: 5 })).toEqual({
      screen: "JobStatus",
      jobId: 5,
    });
  });

  test("chat_message routes to Chat", () => {
    expect(getNotificationRoute({ type: "chat_message", job_id: 9 })).toEqual({
      screen: "Chat",
      jobId: 9,
    });
  });

  test("an unrecognized type returns null rather than throwing", () => {
    expect(getNotificationRoute({ type: "something_new", job_id: 3 })).toBeNull();
  });
});
