import { getNameFieldCopy } from "./getNameFieldCopy";

describe("getNameFieldCopy", () => {
  it("gives the worker path an ID-matching label and example placeholder", () => {
    expect(getNameFieldCopy("worker")).toEqual({
      label: "Full name (as it appears on your ID)",
      placeholder: "e.g. Jane M. Nghidinwa",
    });
  });

  it("keeps the customer path plain, no label", () => {
    expect(getNameFieldCopy("customer")).toEqual({
      label: null,
      placeholder: "Full name",
    });
  });
});
