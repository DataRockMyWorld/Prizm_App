import { activeJobPhase, isCancelWindowOpen } from "./statusTransitions";

test("activeJobPhase maps each in-flight status to its screen phase", () => {
  expect(activeJobPhase("accepted")).toBe("heading_there");
  expect(activeJobPhase("arrived")).toBe("evaluate");
  expect(activeJobPhase("quote_accepted")).toBe("ready_to_start");
  expect(activeJobPhase("in_progress")).toBe("in_progress");
});

test("activeJobPhase returns null for statuses ActiveJobScreen doesn't render", () => {
  expect(activeJobPhase("searching")).toBeNull();
  expect(activeJobPhase("matched")).toBeNull();
  expect(activeJobPhase("quote_pending")).toBeNull(); // → WaitingForConfirmation
  expect(activeJobPhase("completed")).toBeNull();
  expect(activeJobPhase("declined")).toBeNull();
  expect(activeJobPhase("cancelled")).toBeNull();
  expect(activeJobPhase("disputed")).toBeNull();
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
