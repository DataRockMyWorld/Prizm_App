import type { JobStatus } from "@prizm/api";

import { formatJobStatusLabel, getStatusTone } from "./formatJobStatus";

const ALL_STATUSES: JobStatus[] = [
  "requested",
  "searching",
  "matched",
  "accepted",
  "arrived",
  "quote_pending",
  "quote_accepted",
  "in_progress",
  "completed",
  "cancelled",
  "declined",
  "disputed",
];

test("every status maps to a label and a tone, no gaps", () => {
  for (const status of ALL_STATUSES) {
    expect(formatJobStatusLabel(status)).toBeTruthy();
    expect(getStatusTone(status)).toBeTruthy();
  }
});

test("getStatusTone assigns the expected tone per status", () => {
  expect(getStatusTone("requested")).toBe("neutral");
  expect(getStatusTone("matched")).toBe("neutral");
  expect(getStatusTone("accepted")).toBe("active");
  expect(getStatusTone("arrived")).toBe("active");
  expect(getStatusTone("quote_pending")).toBe("waiting");
  expect(getStatusTone("quote_accepted")).toBe("active");
  expect(getStatusTone("in_progress")).toBe("active");
  expect(getStatusTone("completed")).toBe("success");
  expect(getStatusTone("cancelled")).toBe("neutral");
  // A worker declining after evaluating is a routine outcome, not an alarm.
  expect(getStatusTone("declined")).toBe("neutral");
  expect(getStatusTone("disputed")).toBe("danger");
});

test("v2 labels read from the customer's point of view", () => {
  expect(formatJobStatusLabel("arrived")).toBe("Assessing the job");
  expect(formatJobStatusLabel("quote_pending")).toBe("Confirm the price");
  expect(formatJobStatusLabel("quote_accepted")).toBe("About to start");
  expect(formatJobStatusLabel("declined")).toBe("Declined by worker");
});
