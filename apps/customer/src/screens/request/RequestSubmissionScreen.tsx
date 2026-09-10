import { Address, ServiceCategory, createJobRequest, listAddresses, listCategories, useAuth } from "@prizm/api";
import { Button, Card, Screen, TextField, ThemedText, UploadTile, colors, fontFamily, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

// A tiny (16x16) seamless diagonal-hatch tile, tiled via Image's
// resizeMode="repeat" — stands in for the map behind the location pin
// (approved hi-fi) without pulling in a mapping SDK or react-native-svg
// (neither is a dependency of this app) for what's explicitly a
// placeholder, not a real map.
const HATCH_PATTERN_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAY0lEQVR4nKXOuw3AMAhFUYep0rnNVCk8VVp3b6yIFJEs/4BHAdW5IiViUJ8iuqJY78FgHWHwma9bGOz6AANsDmCCTQEs8DaADV4GYMDTAIx4GIADdwE4cROI4D8QxV+AwVp4AbZ8PyrX/2YzAAAAAElFTkSuQmCC";

import type { RequestStackParamList } from "../../navigation/types";
import { applySavedAddress } from "../../request/applySavedAddress";
import { geocodeAddress } from "../../request/geocodeAddress";

type Props = NativeStackScreenProps<RequestStackParamList, "RequestSubmission">;

export function RequestSubmissionScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const prefill = route.params?.prefill;
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [address, setAddress] = useState(prefill?.address ?? "");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    prefill && prefill.latitude != null && prefill.longitude != null
      ? { latitude: prefill.latitude, longitude: prefill.longitude }
      : null
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listCategories(accessToken)
      .then((data) => {
        setCategories(data);
        // A specific category (tapped from a Home tile) skips the picker
        // below and goes straight to the form. Arriving with no category
        // (the generic "Request a Service" button) shows the picker
        // instead of silently defaulting to the first one alphabetically.
        const categoryId = route.params?.categoryId;
        const match = categoryId ? data.find((c) => c.id === categoryId) : undefined;
        setCategory(match || null);
      })
      .catch(() => {});
  }, [accessToken, route.params?.categoryId]);

  useEffect(() => {
    if (!accessToken) return;
    listAddresses(accessToken)
      .then(setSavedAddresses)
      .catch(() => {});
  }, [accessToken]);

  const selectSavedAddress = (saved: Address) => {
    const applied = applySavedAddress(saved);
    setAddress(applied.address);
    setCoords(applied.coords);
    setIsEditingAddress(false);
  };

  // Fallback for when GPS failed/was denied (or the customer just wants
  // to override a resolved address): a manually-typed address is only
  // useful once it's actually resolved to real coordinates — Submit
  // needs a real lat/long for the matching-radius query regardless of
  // where it came from. Runs on blur rather than on every keystroke.
  const handleAddressBlur = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;
    setIsGeocoding(true);
    setGeocodeError(null);
    const result = await geocodeAddress(trimmed);
    setIsGeocoding(false);
    if (result) {
      setCoords(result);
      setLocationError(null);
      setIsEditingAddress(false);
    } else {
      setGeocodeError("Couldn't find that address — try adding more detail");
    }
  };

  useEffect(() => {
    // "Request again" after a decline carries the previous job's location —
    // don't stomp it with a fresh GPS lookup.
    if (prefill && prefill.latitude != null && prefill.longitude != null) return;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Location permission denied — enter your address manually.");
        setIsEditingAddress(true);
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({});
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        const [place] = await Location.reverseGeocodeAsync(position.coords);
        if (place) {
          setAddress(
            [place.streetNumber, place.street, place.city].filter(Boolean).join(" ") ||
              "Current location"
          );
        }
      } catch {
        setLocationError("Couldn't get your location — enter your address manually.");
        setIsEditingAddress(true);
      }
    })();
  }, []);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const canSubmit = Boolean(category && coords && description.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !accessToken || !category || !coords) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const job = await createJobRequest(accessToken, {
        category: category.id,
        description: description.trim(),
        address,
        latitude: coords.latitude,
        longitude: coords.longitude,
        photoUri,
      });
      navigation.replace("Searching", { jobId: job.id });
    } catch {
      setError("Couldn't submit your request. Please try again.");
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
        <ThemedText variant="subtitle" style={styles.headingBold}>
          Request a service
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {!category ? (
        <View style={styles.pickerList}>
          <ThemedText variant="caption" style={styles.label}>
            Choose a service
          </ThemedText>
          {categories.map((c) => (
            <Pressable key={c.id} style={styles.pickerRow} onPress={() => setCategory(c)}>
              <View style={styles.categoryIcon} />
              <ThemedText variant="body" style={styles.pickerRowLabel}>
                {c.name}
              </ThemedText>
              <ThemedText variant="subtitle" style={styles.pickerChevron}>
                ›
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          {/* flex:1 + justifyContent:"space-evenly" — rather than fixed
           * per-section margins — is what actually distributes these 5
           * sections down the full screen instead of clustering near the
           * top with a dead gap below Submit (confirmed live: that's
           * exactly what the old fixed-margin layout produced). Submit
           * itself sits outside this container, immediately below it, so
           * it lands near the bottom as a natural consequence of this
           * flex filling the available height — not via its own spacer. */}
          <View style={styles.formBody}>
            <Card style={styles.categoryChip}>
              <View style={styles.categoryIcon} />
              <ThemedText variant="subtitle" style={styles.chipLabel}>
                {category.name}
              </ThemedText>
              <Pressable onPress={() => setCategory(null)}>
                <ThemedText variant="caption" style={styles.link}>
                  Change
                </ThemedText>
              </Pressable>
            </Card>

            <View>
              <ThemedText variant="caption" style={styles.label}>
                What do you need done?
              </ThemedText>
              <TextField
                placeholder="e.g. 2-bedroom flat, deep clean, kitchen and bathroom focus"
                value={description}
                onChangeText={setDescription}
                multiline
                style={styles.descriptionField}
              />
            </View>

            <View>
              <ThemedText variant="caption" style={styles.label}>
                Location
              </ThemedText>
              {savedAddresses.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.savedAddressRow}
                >
                  {savedAddresses.map((saved) => (
                    <Pressable
                      key={saved.id}
                      onPress={() => selectSavedAddress(saved)}
                      style={styles.savedAddressChip}
                    >
                      <ThemedText variant="caption">{saved.label}</ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {/* Map/location placeholder (approved hi-fi) — a hatched
               * tile background behind a centered pin, sitting between
               * the Location label/quick-picks and the resolved address
               * row below. Purely decorative (no map SDK), matching the
               * hi-fi's own "placeholder" framing. */}
              <View style={styles.mapPlaceholder}>
                <Image
                  source={{ uri: HATCH_PATTERN_URI }}
                  resizeMode="repeat"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.mapPin} />
              </View>
              {!coords && !locationError ? (
                <ActivityIndicator color={colors.primary} style={styles.locationLoading} />
              ) : (
                <View style={styles.locationRow}>
                  {isEditingAddress ? (
                    <TextField
                      placeholder="Enter your address"
                      value={address}
                      onChangeText={(text) => {
                        setAddress(text);
                        setGeocodeError(null);
                      }}
                      style={styles.addressField}
                      autoFocus
                      onBlur={handleAddressBlur}
                    />
                  ) : (
                    <>
                      <ThemedText variant="body" style={{ flex: 1 }}>
                        {address || "Current location"}
                      </ThemedText>
                      <Pressable onPress={() => setIsEditingAddress(true)}>
                        <ThemedText variant="caption" style={styles.link}>
                          Edit
                        </ThemedText>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
              {locationError && <ThemedText variant="caption">{locationError}</ThemedText>}
              {isGeocoding && (
                <ThemedText variant="caption">Looking up that address…</ThemedText>
              )}
              {geocodeError && (
                <ThemedText variant="caption" style={styles.geocodeError}>
                  {geocodeError}
                </ThemedText>
              )}
            </View>

            <UploadTile
              label="Add a photo (optional)"
              uri={photoUri}
              onPress={pickPhoto}
              onRemove={() => setPhotoUri(undefined)}
            />

            <Card style={styles.priceCard}>
              <ThemedText variant="caption" style={styles.priceTitle}>
                Typical price range
              </ThemedText>
              <ThemedText variant="caption">
                Most {category.name} jobs: N${category.estimate_min}–{category.estimate_max} ·
                estimate only, final price is agreed with your worker
              </ThemedText>
            </Card>
          </View>

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}
          <Button
            label="Submit Request"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            style={styles.submitButton}
          />
        </>
      )}
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
  headingBold: {
    fontFamily: fontFamily.bold,
  },
  // The 5 sections below (category chip, description, location, photo,
  // price) are spaced by this flex container alone, not per-section
  // margins — see the inline comment at its usage site.
  formBody: {
    flex: 1,
    justifyContent: "space-evenly",
  },
  pickerList: {
    marginTop: spacing.sm,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  pickerRowLabel: {
    flex: 1,
  },
  pickerChevron: {
    color: colors.textSecondary,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FDE3D5",
  },
  categoryIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  chipLabel: {
    flex: 1,
  },
  link: {
    color: colors.primary,
  },
  // No marginTop here — that's now formBody's space-evenly gap between
  // sections; this stays tight (label hugging its own field/content).
  label: {
    marginBottom: spacing.xs,
  },
  descriptionField: {
    minHeight: 70,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
  },
  savedAddressRow: {
    flexGrow: 0,
    marginBottom: spacing.xs,
  },
  savedAddressChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
  },
  locationLoading: {
    marginVertical: spacing.sm,
  },
  mapPlaceholder: {
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  // Single-view "map pin" (a common cross-platform CSS/RN trick): a
  // square with 3 rounded corners and 1 sharp corner, rotated -45° so
  // the sharp corner points straight down — a teardrop shape with no
  // icon asset or SVG dependency needed.
  mapPin: {
    width: 28,
    height: 28,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: "-45deg" }],
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addressField: {
    flex: 1,
  },
  geocodeError: {
    color: colors.danger,
  },
  priceCard: {
    backgroundColor: colors.surfaceMuted,
    gap: 2,
  },
  priceTitle: {
    fontFamily: fontFamily.bold,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  submitButton: {
    marginBottom: spacing.md,
  },
});
