import type { JobRequest } from "@prizm/api";

import { sortJobsNewestFirst } from "./sortJobs";

function makeJob(id: number, created_at: string): JobRequest {
  return {
    id,
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
    rating: null,
    created_at,
    updated_at: created_at,
  };
}

test("sorts unordered input newest-first", () => {
  const jobs = [
    makeJob(1, "2026-01-01T10:00:00.000Z"),
    makeJob(2, "2026-01-03T10:00:00.000Z"),
    makeJob(3, "2026-01-02T10:00:00.000Z"),
  ];
  expect(sortJobsNewestFirst(jobs).map((j) => j.id)).toEqual([2, 3, 1]);
});

test("is stable for equal timestamps", () => {
  const jobs = [
    makeJob(1, "2026-01-01T10:00:00.000Z"),
    makeJob(2, "2026-01-01T10:00:00.000Z"),
    makeJob(3, "2026-01-01T10:00:00.000Z"),
  ];
  expect(sortJobsNewestFirst(jobs).map((j) => j.id)).toEqual([1, 2, 3]);
});

test("does not crash on an empty array", () => {
  expect(sortJobsNewestFirst([])).toEqual([]);
});
