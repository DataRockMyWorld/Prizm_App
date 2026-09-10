import { getJobsTabRoute } from "./jobsTabRouting";

test("routes active statuses to the live ActiveJob screen", () => {
  expect(getJobsTabRoute("accepted")).toBe("ActiveJob");
  expect(getJobsTabRoute("arrived")).toBe("ActiveJob");
  expect(getJobsTabRoute("quote_accepted")).toBe("ActiveJob");
  expect(getJobsTabRoute("in_progress")).toBe("ActiveJob");
});

test("routes quote_pending to the quote-wait screen", () => {
  expect(getJobsTabRoute("quote_pending")).toBe("WaitingForConfirmation");
});

test("routes terminal and pre-acceptance statuses to the read-only detail screen", () => {
  expect(getJobsTabRoute("completed")).toBe("JobDetail");
  expect(getJobsTabRoute("disputed")).toBe("JobDetail");
  expect(getJobsTabRoute("cancelled")).toBe("JobDetail");
  expect(getJobsTabRoute("searching")).toBe("JobDetail");
});
