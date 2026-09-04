import { formatClockTime } from "./formatClockTime";

test("formats an ISO timestamp as a short local clock time", () => {
  // 14:08 UTC — assert against the same Date the function itself builds,
  // so this test isn't tied to the runner's timezone.
  const iso = "2026-09-04T14:08:17.403Z";
  const expected = new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  expect(formatClockTime(iso)).toBe(expected);
});

test("differs between two timestamps a minute apart", () => {
  const a = formatClockTime("2026-09-04T14:08:00.000Z");
  const b = formatClockTime("2026-09-04T14:09:00.000Z");

  expect(a).not.toBe(b);
});
