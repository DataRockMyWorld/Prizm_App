import { canRemoveCategory } from "./categoryGuard";

describe("canRemoveCategory", () => {
  it("blocks removing the last remaining category", () => {
    expect(canRemoveCategory([1])).toBe(false);
  });

  it("allows removing when 2 or more categories are selected", () => {
    expect(canRemoveCategory([1, 2])).toBe(true);
    expect(canRemoveCategory([1, 2, 3])).toBe(true);
  });

  it("does not mutate its input", () => {
    const input = [1, 2];
    canRemoveCategory(input);
    expect(input).toEqual([1, 2]);
  });

  it("treats an empty array as not removable (nothing to remove)", () => {
    expect(canRemoveCategory([])).toBe(false);
  });
});
