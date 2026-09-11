import type { JobStatus } from "@prizm/api";

import { formatJobStatusLabel, getPriceCaption, getStatusTone } from "./formatJobStatus";

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

test("every status has a non-empty label and a tone", () => {
  for (const status of ALL_STATUSES) {
    expect(formatJobStatusLabel(status)).toBeTruthy();
    expect(getStatusTone(status)).toBeTruthy();
  }
});

test("v2 labels", () => {
  expect(formatJobStatusLabel("accepted")).toBe("Heading over");
  expect(formatJobStatusLabel("arrived")).toBe("Evaluating");
  expect(formatJobStatusLabel("quote_pending")).toBe("Quote sent");
  expect(formatJobStatusLabel("quote_accepted")).toBe("Ready to start");
  expect(formatJobStatusLabel("declined")).toBe("Declined");
});

test("declined is neutral, not danger", () => {
  expect(getStatusTone("declined")).toBe("neutral");
  expect(getStatusTone("disputed")).toBe("danger");
  expect(getStatusTone("quote_pending")).toBe("waiting");
});

test("price caption reflects agreement state, never 'paid'", () => {
  expect(getPriceCaption("quote_pending")).toBe("quoted");
  expect(getPriceCaption("quote_accepted")).toBe("agreed");
  expect(getPriceCaption("in_progress")).toBe("agreed");
  expect(getPriceCaption("completed")).toBe("confirmed");
  expect(getPriceCaption("accepted")).toBeNull();
});
