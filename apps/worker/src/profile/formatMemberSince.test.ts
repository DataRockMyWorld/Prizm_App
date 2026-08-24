import { formatMemberSince } from "./formatMemberSince";

describe("formatMemberSince", () => {
  it("formats an ISO date as \"Mon 'YY\"", () => {
    expect(formatMemberSince("2025-03-14T10:00:00Z")).toBe("Mar '25");
  });

  it("returns an em dash for null/undefined", () => {
    expect(formatMemberSince(null)).toBe("—");
    expect(formatMemberSince(undefined)).toBe("—");
  });

  it("returns an em dash for an unparseable date string", () => {
    expect(formatMemberSince("not-a-date")).toBe("—");
  });
});
