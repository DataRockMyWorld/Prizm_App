import {
  ServiceCategory,
  apiRequest,
  getWorkerProfile,
  getWorkerStatus,
  listCategories,
  updateWorkerCategories,
  updateWorkerStatus,
  useAuth,
  WorkerStatus,
} from "@prizm/api";
import { BrandHeader, Card, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

interface NearbyJob {
  id: number;
  category: ServiceCategory;
  distance_km: number | null;
  price_range_min: string;
  price_range_max: string;
}

export function HomeScreen() {
  const { accessToken, profile } = useAuth();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [nearbyJobs, setNearbyJobs] = useState<NearbyJob[]>([]);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!accessToken) return;
    try {
      setStatus(await getWorkerStatus(accessToken));
    } catch {
      // leave status null — banner area just won't render until it loads
    }
  }, [accessToken]);

  const loadCategories = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [allCategories, workerProfile] = await Promise.all([
        listCategories(accessToken),
        getWorkerProfile(accessToken),
      ]);
      setCategories(allCategories);
      setSelectedCategoryIds(workerProfile.categories);
    } catch {
      // pills just won't render until this loads
    }
  }, [accessToken]);

  useEffect(() => {
    loadStatus();
    loadCategories();
  }, [loadStatus, loadCategories]);

  const loadNearbyJobs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const jobs = await apiRequest<NearbyJob[]>("/api/jobs/nearby/", { token: accessToken });
      setNearbyJobs(jobs);
    } catch {
      setNearbyJobs([]);
    }
  }, [accessToken]);

  useEffect(() => {
    loadNearbyJobs();
  }, [loadNearbyJobs, status?.is_online]);

  const handleToggleOnline = async (next: boolean) => {
    if (!accessToken) return;
    setIsTogglingOnline(true);
    try {
      if (next) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === "granted") {
          const position = await Location.getCurrentPositionAsync({});
          await updateWorkerStatus(accessToken, {
            is_online: true,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } else {
          await updateWorkerStatus(accessToken, { is_online: true });
        }
      } else {
        await updateWorkerStatus(accessToken, { is_online: false });
      }
      await loadStatus();
    } finally {
      setIsTogglingOnline(false);
    }
  };

  const toggleCategory = async (categoryId: number) => {
    if (!accessToken) return;
    const next = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    setSelectedCategoryIds(next);
    try {
      await updateWorkerCategories(accessToken, next);
    } catch {
      setSelectedCategoryIds(selectedCategoryIds);
    }
  };

  const idStatus = status?.id_status ?? "not_submitted";
  const isVerified = idStatus === "approved";

  return (
    <Screen>
      <BrandHeader rightAccessory={<View style={styles.avatarPlaceholder} />} />

      {!status ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : isVerified ? (
        <>
          <ThemedText variant="title" style={styles.greeting}>
            Hello, {profile?.full_name || "there"} 👋
          </ThemedText>

          <Card style={styles.onlineCard}>
            <View style={{ flex: 1 }}>
              <ThemedText
                variant="subtitle"
                style={status.is_online ? styles.onlineLabel : undefined}
              >
                {status.is_online ? "You're Online" : "You're Offline"}
              </ThemedText>
              <ThemedText variant="caption">
                {status.is_online ? "Visible to nearby customers" : "Go online to get matched"}
              </ThemedText>
            </View>
            {isTogglingOnline ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={status.is_online}
                onValueChange={handleToggleOnline}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            )}
          </Card>
        </>
      ) : (
        <>
          <ThemedText variant="title" style={styles.sectionHeading}>
            Choose your services
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {categories.map((category) => {
              const isSelected = selectedCategoryIds.includes(category.id);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => toggleCategory(category.id)}
                  style={[styles.pill, isSelected && styles.pillActive]}
                >
                  <ThemedText
                    variant="caption"
                    style={isSelected ? styles.pillTextActive : undefined}
                  >
                    {category.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable onPress={() => navigation.navigate("IdUpload")}>
            <Card style={styles.bannerCard}>
              <View style={{ flex: 1 }}>
                <ThemedText variant="subtitle">
                  {idStatus === "pending"
                    ? "Your ID is under review"
                    : idStatus === "rejected"
                      ? "Your ID was rejected — resubmit"
                      : "Upload your ID to start accepting jobs"}
                </ThemedText>
                <ThemedText variant="caption">
                  {idStatus === "pending" ? "We'll notify you within 24 hours" : "Takes 2 minutes"}
                </ThemedText>
              </View>
              <ThemedText variant="title" style={styles.bannerArrow}>
                →
              </ThemedText>
            </Card>
          </Pressable>
        </>
      )}

      <ThemedText variant="subtitle" style={styles.sectionTitle}>
        Jobs near you
      </ThemedText>
      {nearbyJobs.length === 0 ? (
        <ThemedText variant="caption" style={styles.emptyState}>
          {status?.is_online
            ? "No open jobs nearby right now."
            : isVerified
              ? "Go online to see nearby jobs."
              : "Jobs browsable now — accepting unlocks once verified."}
        </ThemedText>
      ) : (
        nearbyJobs.map((job) => (
          <Card key={job.id} style={styles.jobRow}>
            <ThemedText variant="body">
              {job.category.name}
              {job.distance_km !== null ? ` · ${job.distance_km}km` : ""}
            </ThemedText>
            <ThemedText variant="caption" style={isVerified ? styles.priceVerified : undefined}>
              Est. N${job.price_range_min}–{job.price_range_max}
            </ThemedText>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.xl,
  },
  avatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
  },
  greeting: {
    marginTop: spacing.md,
  },
  sectionHeading: {
    marginTop: spacing.md,
    fontSize: 18,
  },
  pillRow: {
    flexGrow: 0,
    marginTop: spacing.sm,
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
  onlineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  onlineLabel: {
    color: colors.success,
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3EA",
    borderColor: "#FFE6D3",
    marginTop: spacing.md,
  },
  bannerArrow: {
    color: colors.primary,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  priceVerified: {
    color: colors.primary,
    fontWeight: "700",
  },
  emptyState: {
    textAlign: "center",
    marginTop: spacing.md,
  },
});
