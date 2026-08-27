import {
  Certification,
  getWorkerProfile,
  listCategories,
  listCertifications,
  ServiceCategory,
  updateProfile,
  updateWorkerCategories,
  useAuth,
  WorkerProfile,
} from "@prizm/api";
import { Badge, Card, fontFamily, ProfileHero, Screen, SettingsRow, spacing, StatCard, ThemedText, colors } from "@prizm/ui";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { canRemoveCategory } from "../profile/categoryGuard";
import { formatMemberSince } from "../profile/formatMemberSince";

const CERTIFICATION_STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function ProfileScreen() {
  const { accessToken, profile, setProfile, clearSession } = useAuth();
  const navigation = useNavigation<any>();
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [workerProfileData, categoriesData, certificationsData] = await Promise.all([
        getWorkerProfile(accessToken),
        listCategories(accessToken),
        listCertifications(accessToken),
      ]);
      setWorkerProfile(workerProfileData);
      setCategories(categoriesData);
      setCertifications(certificationsData);
    } catch {
      // Leave whatever state the screen already had rather than crashing.
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !accessToken) return;
    setIsUploadingPhoto(true);
    try {
      const updated = await updateProfile(accessToken, { photoUri: result.assets[0].uri });
      setProfile(updated);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const saveName = async (full_name: string) => {
    if (!accessToken) return;
    const updated = await updateProfile(accessToken, { full_name });
    setProfile(updated);
  };

  const categoryName = (id: number) => categories.find((category) => category.id === id)?.name ?? "";

  const addCategory = async (categoryId: number) => {
    if (!accessToken || !workerProfile) return;
    setCategoryError(null);
    const updated = await updateWorkerCategories(accessToken, [
      ...workerProfile.categories,
      categoryId,
    ]);
    setWorkerProfile(updated);
    setIsAddingCategory(false);
  };

  const removeCategory = async (categoryId: number) => {
    if (!accessToken || !workerProfile) return;
    setCategoryError(null);
    if (!canRemoveCategory(workerProfile.categories)) {
      setCategoryError("You need at least one service to stay matchable.");
      return;
    }
    const updated = await updateWorkerCategories(
      accessToken,
      workerProfile.categories.filter((id) => id !== categoryId)
    );
    setWorkerProfile(updated);
  };

  const availableCategories = categories.filter(
    (category) => !workerProfile?.categories.includes(category.id)
  );

  const subtitle = workerProfile?.categories.length
    ? workerProfile.categories.map(categoryName).filter(Boolean).join(" · ")
    : undefined;

  const badges: React.ReactNode[] = [];
  if (workerProfile?.id_status === "approved") {
    badges.push(<Badge key="verified" label="✓ Verified" tone="verified" />);
  }
  // Only shown for services still being offered — a certification for a
  // category the worker has since dropped from "Services offered" stays
  // on file (still counts for matching if re-added) but isn't badged here.
  const approvedCertCategoryIds = Array.from(
    new Set(
      certifications
        .filter(
          (cert) =>
            cert.status === "approved" && workerProfile?.categories.includes(cert.category)
        )
        .map((cert) => cert.category)
    )
  );
  approvedCertCategoryIds.forEach((categoryId) => {
    badges.push(
      <Badge
        key={`cert-${categoryId}`}
        label={`Certified — ${categoryName(categoryId)}`}
        tone="certified"
      />
    );
  });

  const jobsCompleted = workerProfile?.jobs_completed ?? 0;
  const ratingAverage = workerProfile?.rating_average ?? null;
  let ratingLine: string | undefined;
  if (jobsCompleted > 0) {
    const jobsLabel = `${jobsCompleted} job${jobsCompleted === 1 ? "" : "s"} completed`;
    ratingLine = ratingAverage !== null ? `★ ${ratingAverage.toFixed(1)} · ${jobsLabel}` : jobsLabel;
  }

  return (
    <Screen edges={["top", "bottom"]} style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ProfileHero
          variant="worker"
          photo={profile?.photo ?? null}
          fullName={profile?.full_name ?? ""}
          onPickPhoto={pickPhoto}
          onSaveName={saveName}
          isUploadingPhoto={isUploadingPhoto}
          subtitle={subtitle}
          badges={badges.length > 0 ? badges : undefined}
          ratingLine={ratingLine}
        />

        <View style={styles.content}>
          <StatCard
            items={[
              { value: String(jobsCompleted), label: "Jobs" },
              { value: formatMemberSince(profile?.date_joined), label: "Member since" },
            ]}
          />

          <ThemedText variant="caption" style={styles.sectionLabel}>
            SERVICES OFFERED
          </ThemedText>
          <Card>
            <View style={styles.chipRow}>
              {workerProfile?.categories.map((id) => (
                <View key={id} style={styles.chip}>
                  <ThemedText variant="caption">{categoryName(id)}</ThemedText>
                  <Pressable onPress={() => removeCategory(id)} hitSlop={8}>
                    <ThemedText variant="caption" style={styles.chipRemove}>
                      ×
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => setIsAddingCategory((value) => !value)}
                style={styles.addChip}
                hitSlop={8}
              >
                <ThemedText variant="caption" style={styles.addChipText}>
                  + Add
                </ThemedText>
              </Pressable>
            </View>
            {isAddingCategory && (
              <View style={[styles.chipRow, styles.chipRowSpaced]}>
                {availableCategories.length > 0 ? (
                  availableCategories.map((category) => (
                    <Pressable
                      key={category.id}
                      onPress={() => addCategory(category.id)}
                      style={styles.chip}
                    >
                      <ThemedText variant="caption">{category.name}</ThemedText>
                    </Pressable>
                  ))
                ) : (
                  <ThemedText variant="caption">You're offering every available service.</ThemedText>
                )}
              </View>
            )}
            {categoryError && <ThemedText style={styles.error}>{categoryError}</ThemedText>}
          </Card>

          <ThemedText variant="caption" style={styles.sectionLabel}>
            CERTIFICATIONS
          </ThemedText>
          <Card>
            {certifications.length === 0 && (
              <ThemedText variant="caption" style={styles.emptyText}>
                No certifications added yet.
              </ThemedText>
            )}
            {certifications.map((cert, index) => (
              <View key={cert.id} style={[styles.certRow, index === 0 && styles.certRowFirst]}>
                <View style={styles.certInfo}>
                  <ThemedText variant="body">{categoryName(cert.category)}</ThemedText>
                  <ThemedText variant="caption">
                    {new Date(cert.created_at).toLocaleDateString()}
                  </ThemedText>
                </View>
                <Badge
                  label={CERTIFICATION_STATUS_LABEL[cert.status]}
                  tone={cert.status === "approved" ? "verified" : "neutral"}
                />
              </View>
            ))}
            <Pressable
              onPress={() => navigation.navigate("Certifications", { returnTo: "profile" })}
              style={styles.addCertLink}
              hitSlop={8}
            >
              <ThemedText variant="body" style={styles.addCertText}>
                + Add another certificate
              </ThemedText>
            </Pressable>
          </Card>

          <ThemedText variant="caption" style={styles.sectionLabel}>
            ACCOUNT
          </ThemedText>
          <Card>
            <SettingsRow
              label="Payout method"
              onPress={() => navigation.navigate("ComingSoon", { title: "Payout method" })}
              isFirst
            />
            <SettingsRow
              label="Notification preferences"
              onPress={() => navigation.navigate("ComingSoon", { title: "Notification preferences" })}
            />
            <SettingsRow label="Help & support" onPress={() => navigation.navigate("HelpSupport")} />
            <SettingsRow label="Safety tips" onPress={() => navigation.navigate("SafetyTips")} />
            <SettingsRow
              label="Terms & liability"
              detail={profile?.liability_acknowledged_at ? "Accepted" : undefined}
              onPress={() => navigation.navigate("TermsLiability")}
            />
          </Card>
          <Card style={styles.logoutCard}>
            <Pressable onPress={clearSession} style={styles.logoutRow}>
              <ThemedText variant="subtitle" style={styles.logoutText}>
                Log out
              </ThemedText>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    // Pulls the stat card up so it overlaps the gradient hero's rounded
    // bottom edge, per the hi-fi mockup.
    marginTop: -spacing.lg,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chipRowSpaced: {
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipRemove: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bold,
  },
  addChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addChipText: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  emptyText: {},
  certRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  certRowFirst: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  certInfo: {
    gap: 2,
  },
  addCertLink: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  addCertText: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bold,
  },
  logoutCard: {
    padding: 0,
    overflow: "hidden",
  },
  logoutRow: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  logoutText: {
    color: colors.primary,
  },
});
