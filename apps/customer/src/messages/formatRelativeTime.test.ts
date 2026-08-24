import { formatRelativeTime } from "./formatRelativeTime";

const NOW = new Date("2026-08-24T12:00:00Z");

function secondsAgo(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

describe("formatRelativeTime", () => {
  it("under 60s reads 'Just now'", () => {
    expect(formatRelativeTime(secondsAgo(30), NOW)).toBe("Just now");
  });

  it("exactly 60s rolls over to '1m ago', not 'Just now'", () => {
    expect(formatRelativeTime(secondsAgo(60), NOW)).toBe("1m ago");
  });

  it("minutes bucket", () => {
    expect(formatRelativeTime(secondsAgo(5 * 60), NOW)).toBe("5m ago");
  });

  it("exactly 1 hour rolls over to '1h ago', not '60m ago'", () => {
    expect(formatRelativeTime(secondsAgo(60 * 60), NOW)).toBe("1h ago");
  });

  it("hours bucket", () => {
    expect(formatRelativeTime(secondsAgo(5 * 60 * 60), NOW)).toBe("5h ago");
  });

  it("exactly 24h reads 'Yesterday', not '24h ago'", () => {
    expect(formatRelativeTime(secondsAgo(24 * 60 * 60), NOW)).toBe("Yesterday");
  });

  it("36h still reads 'Yesterday'", () => {
    expect(formatRelativeTime(secondsAgo(36 * 60 * 60), NOW)).toBe("Yesterday");
  });

  it("exactly 48h rolls over to a short date, not 'Yesterday'", () => {
    expect(formatRelativeTime(secondsAgo(48 * 60 * 60), NOW)).toBe("Aug 22");
  });

  it("a same-year date beyond 48h is a short month/day", () => {
    expect(formatRelativeTime("2026-08-10T12:00:00Z", NOW)).toBe("Aug 10");
  });

  it("a prior-year date includes the year", () => {
    expect(formatRelativeTime("2025-08-10T12:00:00Z", NOW)).toBe("Aug 10, 2025");
  });
});
