import { computeJobDuration, formatFullDateTime } from "./jobDetailFormatting";

test("formatFullDateTime renders the full date and time", () => {
  const date = new Date(2026, 7, 20, 14, 20);
  expect(formatFullDateTime(date.toISOString())).toBe("20 Aug 2026 · 14:20");
});

test("computeJobDuration returns hours and minutes for a multi-hour job", () => {
  const acceptedAt = new Date(2026, 7, 20, 11, 10).toISOString();
  const completedAt = new Date(2026, 7, 20, 14, 20).toISOString();
  expect(computeJobDuration(acceptedAt, completedAt)).toBe("3h 10m");
});

test("computeJobDuration returns just minutes for a sub-hour job", () => {
  const acceptedAt = new Date(2026, 7, 20, 11, 0).toISOString();
  const completedAt = new Date(2026, 7, 20, 11, 25).toISOString();
  expect(computeJobDuration(acceptedAt, completedAt)).toBe("25m");
});

test("computeJobDuration returns null without an accepted_at", () => {
  expect(computeJobDuration(null, new Date().toISOString())).toBeNull();
});

test("computeJobDuration returns null for a negative duration", () => {
  const acceptedAt = new Date(2026, 7, 20, 14, 0).toISOString();
  const completedAt = new Date(2026, 7, 20, 11, 0).toISOString();
  expect(computeJobDuration(acceptedAt, completedAt)).toBeNull();
});
