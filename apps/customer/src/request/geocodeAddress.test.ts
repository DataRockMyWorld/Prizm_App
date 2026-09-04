import * as Location from "expo-location";

import { geocodeAddress } from "./geocodeAddress";

jest.mock("expo-location", () => ({ geocodeAsync: jest.fn() }));

const mockGeocodeAsync = Location.geocodeAsync as jest.Mock;

afterEach(() => {
  mockGeocodeAsync.mockReset();
});

test("returns coordinates from the first match on a successful lookup", async () => {
  mockGeocodeAsync.mockResolvedValue([
    { latitude: -22.5609, longitude: 17.0658, accuracy: 10 },
    { latitude: 1, longitude: 1 },
  ]);

  const result = await geocodeAddress("14 Independence Ave, Windhoek");

  expect(result).toEqual({ latitude: -22.5609, longitude: 17.0658 });
});

test("returns null when the geocoder finds nothing", async () => {
  mockGeocodeAsync.mockResolvedValue([]);

  const result = await geocodeAddress("asdkjhaskjdh not a real place");

  expect(result).toBeNull();
});

test("returns null instead of throwing when the geocoder rejects", async () => {
  mockGeocodeAsync.mockRejectedValue(new Error("network error"));

  const result = await geocodeAddress("14 Independence Ave, Windhoek");

  expect(result).toBeNull();
});

test("returns null without calling the geocoder for a blank address", async () => {
  const result = await geocodeAddress("   ");

  expect(result).toBeNull();
  expect(mockGeocodeAsync).not.toHaveBeenCalled();
});

test("appends a Namibia qualifier to bias the query", async () => {
  mockGeocodeAsync.mockResolvedValue([{ latitude: -22.5609, longitude: 17.0658 }]);

  await geocodeAddress("14 Independence Ave, Windhoek");

  expect(mockGeocodeAsync).toHaveBeenCalledWith("14 Independence Ave, Windhoek, Namibia");
});

test("doesn't duplicate the qualifier if the address already names Namibia", async () => {
  mockGeocodeAsync.mockResolvedValue([{ latitude: -22.5609, longitude: 17.0658 }]);

  await geocodeAddress("Windhoek, Namibia");

  expect(mockGeocodeAsync).toHaveBeenCalledWith("Windhoek, Namibia");
});

test("rejects a match that lands outside Namibia — same real bug found live", async () => {
  // "Ho Ahoe" resolved to a real place in Ghana's Volta Region before this
  // fix — without a bounds check, the job would've silently searched for
  // workers near the wrong country with no error at all.
  mockGeocodeAsync.mockResolvedValue([{ latitude: 6.60095, longitude: 0.46287 }]);

  const result = await geocodeAddress("Ho Ahoe");

  expect(result).toBeNull();
});
