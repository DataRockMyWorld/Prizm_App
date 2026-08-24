import type { Address } from "@prizm/api";

import { applySavedAddress } from "./applySavedAddress";

const SAVED: Address = {
  id: 1,
  label: "Home",
  address_text: "14 Independence Ave, Windhoek",
  latitude: -22.5609,
  longitude: 17.0836,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("applySavedAddress", () => {
  it("maps address_text and lat/lng to the screen's address/coords shape", () => {
    expect(applySavedAddress(SAVED)).toEqual({
      address: "14 Independence Ave, Windhoek",
      coords: { latitude: -22.5609, longitude: 17.0836 },
    });
  });
});
