import { getNextValidStatus, isCancelWindowOpen } from "./statusTransitions";

test("getNextValidStatus returns the next step for each stepper status", () => {
  expect(getNextValidStatus("accepted")).toBe("on_my_way");
  expect(getNextValidStatus("on_my_way")).toBe("arrived");
  expect(getNextValidStatus("arrived")).toBe("in_progress");
});

test("getNextValidStatus returns null once at the end of the stepper", () => {
  expect(getNextValidStatus("in_progress")).toBeNull();
});

test("getNextValidStatus returns null for statuses outside the stepper", () => {
  expect(getNextValidStatus("searching")).toBeNull();
  expect(getNextValidStatus("awaiting_price_confirmation")).toBeNull();
  expect(getNextValidStatus("completed")).toBeNull();
  expect(getNextValidStatus("cancelled")).toBeNull();
  expect(getNextValidStatus("disputed")).toBeNull();
});

test("isCancelWindowOpen is true just under 10 minutes", () => {
  const now = new Date("2026-01-01T12:10:00.000Z");
  const acceptedAt = new Date("2026-01-01T12:00:01.000Z").toISOString();
  expect(isCancelWindowOpen(acceptedAt, now)).toBe(true);
});

test("isCancelWindowOpen is false just over 10 minutes", () => {
  const now = new Date("2026-01-01T12:10:01.000Z");
  const acceptedAt = new Date("2026-01-01T12:00:00.000Z").toISOString();
  expect(isCancelWindowOpen(acceptedAt, now)).toBe(false);
});

test("isCancelWindowOpen is false when there's no accepted_at yet", () => {
  expect(isCancelWindowOpen(null)).toBe(false);
});
