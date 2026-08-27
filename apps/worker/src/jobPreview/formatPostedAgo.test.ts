import { formatPostedAgo } from "./formatPostedAgo";

const NOW = new Date("2026-08-27T14:00:00Z");

describe("formatPostedAgo", () => {
  it("shows 'Just now' for under a minute", () => {
    expect(formatPostedAgo("2026-08-27T13:59:40Z", NOW)).toBe("Just now");
  });

  it("shows minutes for under an hour", () => {
    expect(formatPostedAgo("2026-08-27T13:45:00Z", NOW)).toBe("15 min ago");
  });

  it("shows hours for under a day", () => {
    expect(formatPostedAgo("2026-08-27T09:00:00Z", NOW)).toBe("5 hr ago");
  });

  it("shows days for a day or more", () => {
    expect(formatPostedAgo("2026-08-25T14:00:00Z", NOW)).toBe("2d ago");
  });
});
