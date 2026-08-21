// Confirms the babel-jest TS transform is wired up (T0b). Safe to delete
// once real tests land (T2 in docs/tickets/worker-active-job-flow.md).
import { getApiUrl } from "../client";

test("babel-jest TypeScript transform is wired up", () => {
  expect(typeof getApiUrl()).toBe("string");
});
