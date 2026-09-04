import { AddressInput, createAddress, updateAddress, useAuth } from "@prizm/api";
import { Button, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../navigation/types";
import { geocodeAddress } from "../request/geocodeAddress";

type Props = NativeStackScreenProps<RequestStackParamList, "AddressForm">;

/** Add or edit a saved address — one screen for both, since the fields are
 * identical and only the submit call (create vs update) differs. Location
 * is always (re-)captured from the device's current GPS on open, even when
 * editing an existing address (matches RequestSubmissionScreen's pattern —
 * no new permission-prompt UX to design). This means editing just the
 * label also refreshes the stored coordinates to wherever the phone
 * currently is; accepted tradeoff, see the PRD's open risks. */
export function AddressFormScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const editingAddress = route.params?.address;
  const [label, setLabel] = useState(editingAddress?.label ?? "");
  const [addressText, setAddressText] = useState(editingAddress?.address_text ?? "");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Location permission denied — can't save this address.");
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({});
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        if (!editingAddress) {
          const [place] = await Location.reverseGeocodeAsync(position.coords);
          if (place) {
            const text = [place.streetNumber, place.street, place.city].filter(Boolean).join(" ");
            if (text) setAddressText(text);
          }
        }
      } catch {
        setLocationError("Couldn't get your current location — try again.");
      }
    })();
    // Only ever runs once per screen instance (add/edit is fixed for the
    // lifetime of this screen — route.params doesn't change mid-session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback for when GPS already failed above — this field otherwise
  // just sits there as descriptive text with no way to actually produce
  // the coordinates Save needs. Only geocodes once GPS has already given
  // up (locationError set); the happy path leaves this alone entirely,
  // matching this screen's existing "GPS coords win by default" design.
  const handleAddressTextBlur = async () => {
    const trimmed = addressText.trim();
    if (!locationError || !trimmed) return;
    setIsGeocoding(true);
    setGeocodeError(null);
    const result = await geocodeAddress(trimmed);
    setIsGeocoding(false);
    if (result) {
      setCoords(result);
      setLocationError(null);
    } else {
      setGeocodeError("Couldn't find that address — try adding more detail");
    }
  };

  const canSubmit = Boolean(label.trim() && addressText.trim() && coords);

  const handleSubmit = async () => {
    if (!canSubmit || !accessToken || !coords) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const data: AddressInput = {
        label: label.trim(),
        address_text: addressText.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      if (editingAddress) {
        await updateAddress(accessToken, editingAddress.id, data);
      } else {
        await createAddress(accessToken, data);
      }
      navigation.goBack();
    } catch {
      setError("Couldn't save this address. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">{editingAddress ? "Edit address" : "Add address"}</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ThemedText variant="caption" style={styles.label}>
        Label
      </ThemedText>
      <TextField placeholder="e.g. Home, Work" value={label} onChangeText={setLabel} />

      <ThemedText variant="caption" style={styles.label}>
        Address
      </ThemedText>
      <TextField
        placeholder="Enter your address"
        value={addressText}
        onChangeText={(text) => {
          setAddressText(text);
          setGeocodeError(null);
        }}
        onBlur={handleAddressTextBlur}
        multiline
        style={styles.addressField}
      />

      {!coords && !locationError && (
        <ActivityIndicator color={colors.primary} style={styles.locationLoading} />
      )}
      {locationError && (
        <ThemedText variant="caption" style={styles.error}>
          {locationError}
        </ThemedText>
      )}
      {isGeocoding && <ThemedText variant="caption">Looking up that address…</ThemedText>}
      {geocodeError && (
        <ThemedText variant="caption" style={styles.error}>
          {geocodeError}
        </ThemedText>
      )}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <View style={styles.spacer} />
      <Button label="Save" onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  headerSpacer: {
    width: 24,
  },
  label: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  addressField: {
    minHeight: 70,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
  },
  locationLoading: {
    marginVertical: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  spacer: {
    height: spacing.md,
  },
});
