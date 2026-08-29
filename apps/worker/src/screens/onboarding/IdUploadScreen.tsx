import { submitIdDocument, useAuth } from "@prizm/api";
import {
  Button,
  fontFamily,
  ProgressBar,
  Screen,
  ThemedText,
  UploadTile,
  colors,
  spacing,
} from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { WorkerOnboardingStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerOnboardingStackParamList, "IdUpload">;

/** Offers a photo of the ID document via camera or gallery, whichever the
 * worker has to hand — most will photograph the physical card fresh, but
 * someone with an existing scan shouldn't be forced to re-shoot it.
 * `allowsEditing` (with no fixed `aspect` — ID cards aren't square) puts
 * iOS/Android's own crop-and-confirm screen between capture/selection and
 * accepting the photo, which is also where "Retake" lives before that
 * confirm step; `UploadTile`'s onRemove covers un-doing an already-picked
 * photo afterward. */
function pickIdPhoto(onPicked: (uri: string) => void) {
  Alert.alert("Add photo", undefined, [
    {
      text: "Take Photo",
      onPress: async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });
        if (!result.canceled) onPicked(result.assets[0].uri);
      },
    },
    {
      text: "Choose from Library",
      onPress: async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });
        if (!result.canceled) onPicked(result.assets[0].uri);
      },
    },
    { text: "Cancel", style: "cancel" },
  ]);
}

export function IdUploadScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [frontUri, setFrontUri] = useState<string | undefined>();
  const [backUri, setBackUri] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(frontUri && backUri);

  const handleSubmit = async () => {
    if (!canSubmit || !accessToken || !frontUri || !backUri) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitIdDocument(accessToken, frontUri, backUri);
      navigation.navigate("CertificationsInfo");
    } catch {
      setError("Couldn't upload your ID. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="caption" style={styles.step}>
          STEP 1 OF 2
        </ThemedText>
        <ProgressBar progress={0.5} />
        <ThemedText variant="title">Upload your ID</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          Front and back, as shown in the example
        </ThemedText>
        <UploadTile
          label="ID document — front"
          uri={frontUri}
          onPress={() => pickIdPhoto(setFrontUri)}
          onRemove={() => setFrontUri(undefined)}
        />
        <UploadTile
          label="ID document — back"
          uri={backUri}
          onPress={() => pickIdPhoto(setBackUri)}
          onRemove={() => setBackUri(undefined)}
        />
        <ThemedText variant="caption" style={styles.consent}>
          By submitting, you're allowing Prism's team to manually review
          this document to verify your identity.{" "}
          <ThemedText
            variant="caption"
            style={styles.consentLink}
            onPress={() =>
              // No real privacy-policy screen/URL exists yet (open question,
              // see docs/prds/app-store-readiness.md §6/§9) — a placeholder
              // rather than silently pointing this at Terms & liability,
              // which is a different document.
              Alert.alert("Privacy policy", "Coming soon.")
            }
          >
            Privacy policy
          </ThemedText>
        </ThemedText>
        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        <View style={styles.spacer} />
        <Button
          label="Submit for Review"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  step: {
    color: "#FF6C22",
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: -spacing.sm,
  },
  consent: {
    color: colors.textSecondary,
  },
  consentLink: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
  },
  error: {
    color: colors.danger,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
});
