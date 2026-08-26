import { Address, ServiceCategory, createJobRequest, listAddresses, listCategories, useAuth } from "@prizm/api";
import { Button, Card, Screen, TextField, ThemedText, UploadTile, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";
import { applySavedAddress } from "../../request/applySavedAddress";

type Props = NativeStackScreenProps<RequestStackParamList, "RequestSubmission">;

export function RequestSubmissionScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
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
        const match = route.params?.categoryId
          ? data.find((c) => c.id === route.params.categoryId)
          : undefined;
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

  useEffect(() => {
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
        <ThemedText variant="subtitle">Request a service</ThemedText>
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
          {!coords && !locationError ? (
            <ActivityIndicator color={colors.primary} style={styles.locationLoading} />
          ) : (
            <View style={styles.locationRow}>
              {isEditingAddress ? (
                <TextField
                  placeholder="Enter your address"
                  value={address}
                  onChangeText={setAddress}
                  style={styles.addressField}
                  autoFocus
                  onBlur={() => setIsEditingAddress(false)}
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

          <UploadTile label="Add a photo (optional)" uri={photoUri} onPress={pickPhoto} />

          <Card style={styles.priceCard}>
            <ThemedText variant="caption" style={styles.priceTitle}>
              Typical price range
            </ThemedText>
            <ThemedText variant="caption">
              Most {category.name} jobs: N${category.estimate_min}–{category.estimate_max} ·
              estimate only, final price is agreed with your worker
            </ThemedText>
          </Card>

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}
          <View style={styles.spacer} />
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
    marginBottom: spacing.sm,
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
  label: {
    marginTop: spacing.sm,
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
  priceCard: {
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.sm,
    gap: 2,
  },
  priceTitle: {
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  spacer: {
    height: spacing.md,
  },
  submitButton: {
    marginBottom: spacing.md,
  },
});
