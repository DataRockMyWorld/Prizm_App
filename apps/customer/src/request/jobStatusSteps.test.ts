import type { JobRequest, JobStatus } from "@prizm/api";

import { formatClockTime } from "./formatClockTime";
import { headlineForStatus, STEP_LABELS, timelineState, timestampForStep } from "./jobStatusSteps";

test("STEP_LABELS is the 6-step v2 timeline with no 'on my way'", () => {
  expect(STEP_LABELS).toEqual([
    "Requested",
    "Accepted",
    "Arrived",
    "Price agreed",
    "In progress",
    "Complete",
  ]);
});

test("timelineState per status", () => {
  expect(timelineState("requested")).toEqual({ lastDone: 0, current: 0 });
  expect(timelineState("matched")).toEqual({ lastDone: 0, current: 0 });
  expect(timelineState("accepted")).toEqual({ lastDone: 1, current: 1 });
  expect(timelineState("arrived")).toEqual({ lastDone: 2, current: 2 });
  // quote out for confirmation — work done to "Arrived", "Price agreed" is the ask
  expect(timelineState("quote_pending")).toEqual({ lastDone: 2, current: 3 });
  expect(timelineState("quote_accepted")).toEqual({ lastDone: 3, current: 3 });
  expect(timelineState("in_progress")).toEqual({ lastDone: 4, current: 4 });
  expect(timelineState("completed")).toEqual({ lastDone: 5, current: 5 });
});

test("headlineForStatus", () => {
  expect(headlineForStatus("accepted", "Maria")).toBe("Maria is on the way");
  expect(headlineForStatus("arrived", "Maria")).toBe("Maria is assessing the job");
  expect(headlineForStatus("quote_pending", "Maria")).toBe(
    "Confirm Maria's price to get started"
  );
  expect(headlineForStatus("quote_accepted", "Maria")).toBe("Maria is about to start");
  expect(headlineForStatus("in_progress", "Maria")).toBe("Maria is working");
  expect(headlineForStatus("completed", "Maria")).toBe("Job complete");
  expect(headlineForStatus("searching", "Maria")).toBe("Waiting for Maria to accept");
});

function jobWith(overrides: Partial<JobRequest>): JobRequest {
  return {
    id: 1,
    category: { id: 1, name: "Cleaning", slug: "cleaning", estimate_min: "150", estimate_max: "300" },
    description: "",
    address: "",
    latitude: null,
    longitude: null,
    photo: null,
    status: "quote_accepted" as JobStatus,
    price_range_min: "150",
    price_range_max: "300",
    agreed_price: "220",
    worker_note: "",
    customer: null,
    worker: null,
    current_offer_responds_by: null,
    accepted_at: "2026-09-08T09:14:00Z",
    arrived_at: "2026-09-08T09:38:00Z",
    quoted_at: "2026-09-08T09:40:00Z",
    quote_accepted_at: "2026-09-08T09:42:00Z",
    started_at: null,
    rating: null,
    last_message: null,
    decline_reason: null,
    created_at: "2026-09-08T09:12:00Z",
    updated_at: "",
    ...overrides,
  };
}

test("timestampForStep maps each index to the right field", () => {
  const job = jobWith({});
  expect(timestampForStep(0, job)).toBe(formatClockTime("2026-09-08T09:12:00Z"));
  expect(timestampForStep(1, job)).toBe(formatClockTime("2026-09-08T09:14:00Z"));
  expect(timestampForStep(2, job)).toBe(formatClockTime("2026-09-08T09:38:00Z"));
  // "Price agreed" is backed by quote_accepted_at, not quoted_at
  expect(timestampForStep(3, job)).toBe(formatClockTime("2026-09-08T09:42:00Z"));
  expect(timestampForStep(4, job)).toBeNull(); // started_at null
  expect(timestampForStep(5, job)).toBeNull(); // no "Complete" field
});

test("timestampForStep for 'Price agreed' is null until the quote is confirmed", () => {
  expect(timestampForStep(3, jobWith({ quote_accepted_at: null }))).toBeNull();
});
