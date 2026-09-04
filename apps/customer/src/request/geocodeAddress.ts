import * as Location from "expo-location";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/** Forward-geocodes a manually-typed address into coordinates — the
 * fallback path used once GPS has already failed or been denied.
 * Deliberately never throws: an empty result, a permission failure, or
 * any other geocoding error all collapse to `null`, so callers can just
 * show a plain "couldn't find that address" state instead of handling a
 * rejection themselves. */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const [first] = await Location.geocodeAsync(trimmed);
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch {
    return null;
  }
}
