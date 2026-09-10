import { getJobsTabRoute } from "./jobsTabRouting";

test("routes pre-match statuses to the Searching screen", () => {
  expect(getJobsTabRoute("requested")).toBe("Searching");
  expect(getJobsTabRoute("searching")).toBe("Searching");
});

test("routes matched-through-in-progress statuses to the live JobStatus screen", () => {
  expect(getJobsTabRoute("matched")).toBe("JobStatus");
  expect(getJobsTabRoute("accepted")).toBe("JobStatus");
  expect(getJobsTabRoute("arrived")).toBe("JobStatus");
  expect(getJobsTabRoute("quote_accepted")).toBe("JobStatus");
  expect(getJobsTabRoute("in_progress")).toBe("JobStatus");
});

test("routes quote_pending to the confirm-quote screen", () => {
  expect(getJobsTabRoute("quote_pending")).toBe("ConfirmQuote");
});

test("routes terminal statuses to the read-only detail screen", () => {
  expect(getJobsTabRoute("completed")).toBe("JobDetail");
  expect(getJobsTabRoute("declined")).toBe("JobDetail");
  expect(getJobsTabRoute("disputed")).toBe("JobDetail");
  expect(getJobsTabRoute("cancelled")).toBe("JobDetail");
});
