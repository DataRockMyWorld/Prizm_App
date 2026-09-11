import {
  ServiceCategory,
  getWorkerProfile,
  listCategories,
  submitCertification,
  updateWorkerCategories,
  useAuth,
} from "@prizm/api";
import {
  Badge,
  Button,
  Card,
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
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { WorkerOnboardingStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerOnboardingStackParamList, "Certifications">;

export function CertificationsScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const returnTo = route.params?.returnTo;
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [documentUri, setDocumentUri] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listCategories(accessToken)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [accessToken]);

  const pickDocument = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled) {
      setDocumentUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!documentUri || !selectedCategoryId || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitCertification(accessToken, selectedCategoryId, documentUri);
      // Add to, don't replace, the worker's existing categories — this
      // screen is the only place categories get set during onboarding
      // (fine there, since it starts from empty), but reused from the
      // Profile tab's "+ Add another certificate" it must not silently
      // drop categories the worker already added via the Services-offered
      // editor.
      const currentProfile = await getWorkerProfile(accessToken);
      if (!currentProfile.categories.includes(selectedCategoryId)) {
        await updateWorkerCategories(accessToken, [
          ...currentProfile.categories,
          selectedCategoryId,
        ]);
      }
      if (returnTo === "profile") {
        navigation.goBack();
      } else {
        navigation.navigate("UnderReview");
      }
    } catch {
      setError("Couldn't submit your certificate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategoryName = categories.find((c) => c.id === selectedCategoryId)?.name;

  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        {/* No "step 2 of 2" framing when reached from the Profile tab's "+ Add
            another certificate" — that's not onboarding, there's no step
            count to speak of. */}
        {returnTo !== "profile" && (
          <>
            <ThemedText variant="caption" style={styles.step}>
              STEP 2 OF 2
            </ThemedText>
            <ProgressBar progress={1} />
          </>
        )}
        <View style={styles.badgeRow}>
          <Badge label="OPTIONAL" tone="neutral" />
        </View>
        <ThemedText variant="title">Upload your certificate</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          One per service category you're certified in
        </ThemedText>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setSelectedCategoryId(category.id)}
              style={[styles.pill, selectedCategoryId === category.id && styles.pillActive]}
            >
              <ThemedText
                variant="caption"
                style={selectedCategoryId === category.id ? styles.pillTextActive : undefined}
              >
                {category.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <UploadTile
          label={selectedCategoryName ? `Certificate — ${selectedCategoryName}` : "Choose a category first"}
          uri={documentUri}
          onPress={selectedCategoryId ? pickDocument : () => {}}
          onRemove={() => setDocumentUri(undefined)}
        />

        <Card style={styles.infoCard}>
          <ThemedText variant="caption">
            Not required to go online — your ID verification alone lets you accept jobs.
            Certifications just add extra trust with customers once approved.
          </ThemedText>
        </Card>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <View style={styles.spacer} />
        <Button
          label="Submit for Review"
          onPress={handleSubmit}
          disabled={!documentUri || !selectedCategoryId}
          loading={isSubmitting}
        />
        {returnTo !== "profile" && (
          <Pressable
            onPress={() => navigation.navigate("UnderReview")}
            style={styles.skip}
            hitSlop={8}
          >
            <ThemedText variant="body" style={styles.centered}>
              Skip for now
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Without an explicit flex here, RN sizes the (outer, vertical)
  // ScrollView to its content instead of clipping it to the screen, so
  // long content just overflows past the bottom with no way to scroll to
  // it. Doesn't apply to the horizontal pillRow ScrollView below.
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  step: {
    color: "#FF6C22",
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: "row",
  },
  subtitle: {
    marginTop: -spacing.sm,
  },
  pillRow: {
    flexGrow: 0,
  },
  pill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillTextActive: {
    color: colors.textInverse,
  },
  infoCard: {
    backgroundColor: "#FFF3EA",
    borderColor: "#FFE6D3",
  },
  error: {
    color: colors.danger,
  },
  spacer: {
    flex: 1,
  },
  skip: {
    alignItems: "center",
  },
  centered: {
    textAlign: "center",
  },
});
