import {
  ServiceCategory,
  listCategories,
  submitCertification,
  updateWorkerCategories,
  useAuth,
} from "@prizm/api";
import { Badge, Button, Card, Screen, ThemedText, UploadTile, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { WorkerOnboardingStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerOnboardingStackParamList, "Certifications">;

export function CertificationsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
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
      await updateWorkerCategories(accessToken, [selectedCategoryId]);
      navigation.navigate("UnderReview");
    } catch {
      setError("Couldn't submit your certificate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Badge label="OPTIONAL" tone="neutral" />
        </View>
        <ThemedText variant="title">Add certifications</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          Optional — upload certificates for the services you offer to earn a Certified badge on
          your profile
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
          label={selectedCategoryId ? "Certificate document" : "Choose a category first"}
          uri={documentUri}
          onPress={selectedCategoryId ? pickDocument : () => {}}
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
        <Pressable
          onPress={() => navigation.navigate("UnderReview")}
          style={styles.skip}
          hitSlop={8}
        >
          <ThemedText variant="body" style={styles.centered}>
            Skip for now
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.md,
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
