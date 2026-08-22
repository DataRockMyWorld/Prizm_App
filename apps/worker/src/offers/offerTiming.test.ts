import { computeRemainingSeconds, formatCountdown } from "./offerTiming";

test("computeRemainingSeconds returns the correct value mid-countdown", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");
  const respondsBy = new Date("2026-01-01T12:00:45.000Z").toISOString();
  expect(computeRemainingSeconds(respondsBy, now)).toBe(45);
});

test("computeRemainingSeconds floors at 0 once respondsBy is in the past", () => {
  const now = new Date("2026-01-01T12:01:00.000Z");
  const respondsBy = new Date("2026-01-01T12:00:00.000Z").toISOString();
  expect(computeRemainingSeconds(respondsBy, now)).toBe(0);
});

test("formatCountdown renders mm:ss with zero-padded seconds", () => {
  expect(formatCountdown(60)).toBe("1:00");
  expect(formatCountdown(5)).toBe("0:05");
  expect(formatCountdown(0)).toBe("0:00");
});
