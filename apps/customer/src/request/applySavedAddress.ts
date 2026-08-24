import type { Address } from "@prizm/api";

/** Selecting a saved address fills the same plain `address`/`coords` state
 * RequestSubmissionScreen already uses for GPS-derived input — both stay
 * freely editable afterward, no special-cased submit path. */
export function applySavedAddress(saved: Address): {
  address: string;
  coords: { latitude: number; longitude: number };
} {
  return {
    address: saved.address_text,
    coords: { latitude: saved.latitude, longitude: saved.longitude },
  };
}
