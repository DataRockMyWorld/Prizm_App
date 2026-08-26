import { getProfile, refreshAccessToken } from "./auth";
import { establishSessionFromTokens, restoreSession } from "./sessionEstablishment";

jest.mock("./auth", () => ({
  refreshAccessToken: jest.fn(),
  getProfile: jest.fn(),
}));

const mockRefresh = refreshAccessToken as jest.Mock;
const mockGetProfile = getProfile as jest.Mock;

const PROFILE = { phone_number: "+264800000000", role: "customer", full_name: "Test User" };

beforeEach(() => {
  mockRefresh.mockReset();
  mockGetProfile.mockReset();
});

describe("restoreSession", () => {
  test("returns a full session when both refresh and profile fetch succeed", async () => {
    mockRefresh.mockResolvedValueOnce({ access: "new-access" });
    mockGetProfile.mockResolvedValueOnce(PROFILE);

    const result = await restoreSession("stored-refresh");

    expect(result).toEqual({ access: "new-access", refresh: "stored-refresh", profile: PROFILE });
  });

  test("returns null (not a partial session) when the refresh call itself fails", async () => {
    mockRefresh.mockRejectedValueOnce(new Error("invalid refresh token"));

    const result = await restoreSession("stored-refresh");

    expect(result).toBeNull();
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  test("returns null (not accessToken-with-no-profile) when refresh succeeds but the profile fetch fails", async () => {
    // Regression test for the 2026-08-26 bug: a refresh token can still
    // validate for an account that's since been deleted/deactivated —
    // the profile fetch then 401s. The caller must never see a result
    // that would let it mark the session authenticated without a profile.
    mockRefresh.mockResolvedValueOnce({ access: "new-access" });
    mockGetProfile.mockRejectedValueOnce(new Error("401 unauthorized"));

    const result = await restoreSession("stored-refresh");

    expect(result).toBeNull();
  });
});

describe("establishSessionFromTokens", () => {
  test("returns a full session when the profile fetch succeeds", async () => {
    mockGetProfile.mockResolvedValueOnce(PROFILE);

    const result = await establishSessionFromTokens({ access: "acc", refresh: "ref" });

    expect(result).toEqual({ access: "acc", refresh: "ref", profile: PROFILE });
  });

  test("throws (does not resolve to a partial session) when the profile fetch fails", async () => {
    mockGetProfile.mockRejectedValueOnce(new Error("network error"));

    await expect(establishSessionFromTokens({ access: "acc", refresh: "ref" })).rejects.toThrow();
  });
});
