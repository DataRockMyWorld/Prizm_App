import { Linking, Platform } from "react-native";

/** Universal https:// map URLs rather than a native `maps://` scheme — these
 * always open (falling back to a browser if the native app isn't
 * installed), so no `canOpenURL` check is needed first. */
export function buildDirectionsUrl(
  address: string,
  latitude: number | null,
  longitude: number | null
): string {
  const destination = latitude != null && longitude != null ? `${latitude},${longitude}` : address;
  const encoded = encodeURIComponent(destination);
  if (Platform.OS === "ios") {
    return `https://maps.apple.com/?daddr=${encoded}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

export function openDirections(address: string, latitude: number | null, longitude: number | null) {
  return Linking.openURL(buildDirectionsUrl(address, latitude, longitude));
}
