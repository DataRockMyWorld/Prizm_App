import type { JobRequest } from "@prizm/api";

import { formatJobCardDate, groupByRecency, isActiveJobStatus } from "./jobsTabGrouping";

function makeJob(overrides: Partial<JobRequest> & { id: number; created_at: string }): JobRequest {
  return {
    category: { id: 1, name: "Cleaning", slug: "cleaning", estimate_min: "150", estimate_max: "300" },
    description: "",
    address: "",
    latitude: null,
    longitude: null,
    photo: null,
    status: "completed",
    price_range_min: "150",
    price_range_max: "300",
    agreed_price: null,
    worker_note: "",
    customer: null,
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
    updated_at: overrides.created_at,
    ...overrides,
  };
}

test("isActiveJobStatus treats every non-terminal status as active, including pre-match ones", () => {
  expect(isActiveJobStatus("requested")).toBe(true);
  expect(isActiveJobStatus("searching")).toBe(true);
  expect(isActiveJobStatus("matched")).toBe(true);
  expect(isActiveJobStatus("accepted")).toBe(true);
  expect(isActiveJobStatus("arrived")).toBe(true);
  expect(isActiveJobStatus("quote_pending")).toBe(true);
  expect(isActiveJobStatus("quote_accepted")).toBe(true);
  expect(isActiveJobStatus("in_progress")).toBe(true);
  expect(isActiveJobStatus("completed")).toBe(false);
  expect(isActiveJobStatus("cancelled")).toBe(false);
  expect(isActiveJobStatus("declined")).toBe(false);
  expect(isActiveJobStatus("disputed")).toBe(false);
});

test("groupByRecency splits jobs into this-week and earlier", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");
  const jobs = [
    makeJob({ id: 1, created_at: "2026-08-22T12:00:00.000Z" }), // 1 day ago
    makeJob({ id: 2, created_at: "2026-08-01T12:00:00.000Z" }), // 22 days ago
  ];
  const { thisWeek, earlier } = groupByRecency(jobs, now);
  expect(thisWeek.map((j) => j.id)).toEqual([1]);
  expect(earlier.map((j) => j.id)).toEqual([2]);
});

test("groupByRecency puts a job exactly 7 days old in earlier, not this-week", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");
  const jobs = [makeJob({ id: 1, created_at: "2026-08-16T12:00:00.000Z" })]; // exactly 7 days ago
  const { thisWeek, earlier } = groupByRecency(jobs, now);
  expect(thisWeek).toEqual([]);
  expect(earlier.map((j) => j.id)).toEqual([1]);
});

test("formatJobCardDate shows Today with a time for today's date", () => {
  // Local-time constructors, not UTC ISO strings — formatJobCardDate reads
  // local hours/date, so the test needs to be timezone-independent too.
  const now = new Date(2026, 7, 23, 14, 30);
  const target = new Date(2026, 7, 23, 9, 5);
  expect(formatJobCardDate(target.toISOString(), now)).toBe("Today · 09:05");
});

test("formatJobCardDate shows a short date for other days", () => {
  const now = new Date(2026, 7, 23, 14, 30);
  const target = new Date(2026, 7, 20, 9, 5);
  expect(formatJobCardDate(target.toISOString(), now)).toBe("20 Aug");
});
