import type { JobRequest } from "@prizm/api";

import { sortThreadsByRecency } from "./sortThreads";

function makeJob(
  id: number,
  updated_at: string,
  lastMessageAt?: string
): JobRequest {
  return {
    id,
    category: { id: 1, name: "Cleaning", slug: "cleaning", estimate_min: "150", estimate_max: "300" },
    description: "",
    address: "",
    latitude: null,
    longitude: null,
    photo: null,
    status: "accepted",
    price_range_min: "150",
    price_range_max: "300",
    agreed_price: null,
    worker_note: "",
    customer: null,
    worker: { id: 9, full_name: "Alex", photo: null, verified: true, rating_average: null, jobs_completed: 0 },
    current_offer_responds_by: null,
    accepted_at: null,
    arrived_at: null,
    quoted_at: null,
    quote_accepted_at: null,
    started_at: null,
    rating: null,
    decline_reason: null,
    last_message: lastMessageAt
      ? { text: "hi", created_at: lastMessageAt, sender_id: 9 }
      : null,
    created_at: updated_at,
    updated_at,
  };
}

describe("sortThreadsByRecency", () => {
  it("orders by last_message.created_at when present", () => {
    const older = makeJob(1, "2026-08-01T00:00:00Z", "2026-08-20T00:00:00Z");
    const newer = makeJob(2, "2026-08-01T00:00:00Z", "2026-08-23T00:00:00Z");

    expect(sortThreadsByRecency([older, newer]).map((j) => j.id)).toEqual([2, 1]);
  });

  it("falls back to updated_at when a job has no messages yet", () => {
    const noMessages = makeJob(1, "2026-08-23T00:00:00Z");
    const withMessage = makeJob(2, "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z");

    expect(sortThreadsByRecency([withMessage, noMessages]).map((j) => j.id)).toEqual([1, 2]);
  });

  it("does not mutate the input array", () => {
    const jobs = [makeJob(1, "2026-08-01T00:00:00Z"), makeJob(2, "2026-08-23T00:00:00Z")];
    const original = [...jobs];

    sortThreadsByRecency(jobs);

    expect(jobs).toEqual(original);
  });
});
