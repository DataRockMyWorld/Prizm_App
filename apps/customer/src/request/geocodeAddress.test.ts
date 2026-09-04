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
