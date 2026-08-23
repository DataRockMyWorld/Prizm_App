import { getJobsTabRoute } from "./jobsTabRouting";

test("routes active statuses to the live ActiveJob screen", () => {
  expect(getJobsTabRoute("accepted")).toBe("ActiveJob");
  expect(getJobsTabRoute("on_my_way")).toBe("ActiveJob");
  expect(getJobsTabRoute("arrived")).toBe("ActiveJob");
  expect(getJobsTabRoute("in_progress")).toBe("ActiveJob");
});

test("routes awaiting_price_confirmation to the waiting screen", () => {
  expect(getJobsTabRoute("awaiting_price_confirmation")).toBe("WaitingForConfirmation");
});

test("routes terminal and pre-acceptance statuses to the read-only detail screen", () => {
  expect(getJobsTabRoute("completed")).toBe("JobDetail");
  expect(getJobsTabRoute("disputed")).toBe("JobDetail");
  expect(getJobsTabRoute("cancelled")).toBe("JobDetail");
  expect(getJobsTabRoute("searching")).toBe("JobDetail");
});
