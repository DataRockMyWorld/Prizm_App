import * as Location from "expo-location";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

interface GeocodeRegion {
  name: string;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

// expo-location's geocodeAsync has no country/region-bias parameter — it's
// a thin wrapper over the platform geocoder (CLGeocoder/Android Geocoder),
// neither of which Expo exposes bounding options for. Confirmed live: a
// short/ambiguous address ("Ho Ahoe") silently resolved to a real place in
// Ghana instead of failing, since nothing scoped the search to the actual
// pilot region — the resulting job would've sat in `searching` forever
// with zero eligible workers (everyone real is >25km away), no error, no
// explanation. Two mitigations below: append the region name to bias the
// query, and reject any result that still lands outside the region's
// rough bounding box as "not found" rather than trusting a same-named
// place elsewhere.
//
// Namibia is the only real pilot target (see CLAUDE.md) — this is NOT a
// second market, it's a dev-environment override. EXPO_PUBLIC_GEOCODE_REGION
// exists solely so the region can be built/tested from wherever the
// developer actually is without every manual-address test failing the
// bounds check; leave it unset (defaulting to Namibia) for anything
// touching real pilot data.
const REGIONS: Record<string, GeocodeRegion> = {
  namibia: { name: "Namibia", bounds: { minLat: -29.1, maxLat: -16.9, minLng: 11.6, maxLng: 25.3 } },
  ghana: { name: "Ghana", bounds: { minLat: 4.5, maxLat: 11.2, minLng: -3.3, maxLng: 1.2 } },
};

const region = REGIONS[(process.env.EXPO_PUBLIC_GEOCODE_REGION || "namibia").toLowerCase()] ?? REGIONS.namibia;

function isWithinRegion(latitude: number, longitude: number): boolean {
  return (
    latitude >= region.bounds.minLat &&
    latitude <= region.bounds.maxLat &&
    longitude >= region.bounds.minLng &&
    longitude <= region.bounds.maxLng
  );
}

/** Forward-geocodes a manually-typed address into coordinates — the
 * fallback path used once GPS has already failed or been denied.
 * Deliberately never throws: an empty result, a permission failure, an
 * out-of-region match, or any other geocoding error all collapse to
 * `null`, so callers can just show a plain "couldn't find that address"
 * state instead of handling a rejection themselves. */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  const regionNamePattern = new RegExp(region.name, "i");
  const query = regionNamePattern.test(trimmed) ? trimmed : `${trimmed}, ${region.name}`;
  try {
    const [first] = await Location.geocodeAsync(query);
    if (!first) return null;
    if (!isWithinRegion(first.latitude, first.longitude)) return null;
    return { latitude: first.latitude, longitude: first.longitude };
  } catch {
    return null;
  }
}
