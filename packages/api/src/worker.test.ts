import { submitIdDocument } from "./worker";

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
  return { url, method: options.method, body: options.body as FormData };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

test("submitIdDocument sends both front and back as separate multipart fields", async () => {
  mockFetchOnce({ id_document: "front.jpg", id_document_back: "back.jpg" });
  await submitIdDocument("tok", "file:///front.jpg", "file:///back.jpg");
  const { url, method, body } = lastCall();

  expect(url).toContain("/api/auth/worker-profile/");
  expect(method).toBe("PATCH");
  expect(body).toBeInstanceOf(FormData);
  // Node's FormData (unlike React Native's) stringifies the {uri, name,
  // type} object RN uses for file uploads rather than preserving it, so
  // this can only assert presence under the right field names here — the
  // actual upload behavior is exercised for real by the backend's
  // multipart tests (backend/accounts/tests/test_id_document.py).
  expect(body.has("id_document")).toBe(true);
  expect(body.has("id_document_back")).toBe(true);
  expect([...body.keys()]).toEqual(["id_document", "id_document_back"]);
});
