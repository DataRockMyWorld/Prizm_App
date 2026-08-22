import { Platform } from "react-native";

import { buildDirectionsUrl } from "./directions";

test("builds an Apple Maps URL with lat/lng on iOS", () => {
  Platform.OS = "ios";
  expect(buildDirectionsUrl("14 Independence Ave, Windhoek", -22.5609, 17.0658)).toBe(
    "https://maps.apple.com/?daddr=-22.5609%2C17.0658"
  );
});

test("falls back to the address when coordinates are missing", () => {
  Platform.OS = "ios";
  expect(buildDirectionsUrl("14 Independence Ave, Windhoek", null, null)).toBe(
    "https://maps.apple.com/?daddr=14%20Independence%20Ave%2C%20Windhoek"
  );
});

test("builds a Google Maps URL on Android", () => {
  Platform.OS = "android";
  expect(buildDirectionsUrl("14 Independence Ave, Windhoek", -22.5609, 17.0658)).toBe(
    "https://www.google.com/maps/dir/?api=1&destination=-22.5609%2C17.0658"
  );
});
