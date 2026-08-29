import { ApiError } from "./client";
import { getDeleteAccountErrorMessage } from "./auth";

describe("getDeleteAccountErrorMessage", () => {
  it("surfaces the backend's own explanation from a 400 ApiError", () => {
    const err = new ApiError(400, {
      detail: "Finish or cancel your active job before deleting your account.",
    });
    expect(getDeleteAccountErrorMessage(err)).toBe(
      "Finish or cancel your active job before deleting your account."
    );
  });

  it("falls back to a generic message when the error has no detail string", () => {
    const err = new ApiError(500, { something: "else" });
    expect(getDeleteAccountErrorMessage(err)).toBe(
      "Couldn't delete your account. Please try again."
    );
  });

  it("falls back to a generic message for a non-ApiError (e.g. a network failure)", () => {
    expect(getDeleteAccountErrorMessage(new TypeError("Network request failed"))).toBe(
      "Couldn't delete your account. Please try again."
    );
  });
});
