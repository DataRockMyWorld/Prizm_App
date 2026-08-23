import type { JobStatus } from "@prizm/api";

import { getStatusTone } from "./formatJobStatus";

const ALL_STATUSES: JobStatus[] = [
  "requested",
  "searching",
  "matched",
  "accepted",
  "on_my_way",
  "arrived",
  "in_progress",
  "awaiting_price_confirmation",
  "completed",
  "cancelled",
  "disputed",
];

test("getStatusTone maps every status to a tone, no gaps", () => {
  for (const status of ALL_STATUSES) {
    expect(getStatusTone(status)).toBeTruthy();
  }
});

test("getStatusTone assigns the expected tone per status", () => {
  expect(getStatusTone("requested")).toBe("neutral");
  expect(getStatusTone("searching")).toBe("neutral");
  expect(getStatusTone("matched")).toBe("neutral");
  expect(getStatusTone("accepted")).toBe("active");
  expect(getStatusTone("on_my_way")).toBe("active");
  expect(getStatusTone("arrived")).toBe("active");
  expect(getStatusTone("in_progress")).toBe("active");
  expect(getStatusTone("awaiting_price_confirmation")).toBe("waiting");
  expect(getStatusTone("completed")).toBe("success");
  expect(getStatusTone("cancelled")).toBe("neutral");
  expect(getStatusTone("disputed")).toBe("danger");
});
