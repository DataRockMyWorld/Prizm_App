import {
  ServiceCategory as NearbyCategory,
  apiRequest,
  getWorkerStatus,
  updateWorkerStatus,
  useAuth,
  WorkerStatus,
} from "@prizm/api";
import { Badge, Card, GradientBackground, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from "react-native";

interface NearbyJob {
  id: number;
  category: NearbyCategory;
  distance_km: number | null;
  price_range_min: string;
  price_range_max: string;
}

export function HomeScreen() {
  const { accessToken, profile } = useAuth();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<WorkerStatus | null>(null);
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

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

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
    if (status?.is_online) {
      loadNearbyJobs();
    }
  }, [status?.is_online, loadNearbyJobs]);

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

  const idStatus = status?.id_status ?? "not_submitted";
  const isVerified = idStatus === "approved";

  return (
    <Screen edges={["bottom"]}>
      <GradientBackground style={styles.header}>
        <ThemedText variant="title" style={styles.headerTitle}>
          Hello, {profile?.full_name || "there"} 👋
        </ThemedText>
      </GradientBackground>

      <View style={styles.body}>
        {!status ? (
          <ActivityIndicator color={colors.primary} />
        ) : isVerified ? (
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText variant="subtitle" style={styles.onlineLabel}>
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
            </View>
          </Card>
        ) : (
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
        )}

        <ThemedText variant="subtitle" style={styles.sectionTitle}>
          Jobs near you
        </ThemedText>
        {nearbyJobs.length === 0 ? (
          <Card>
            <ThemedText variant="caption">
              {status?.is_online
                ? "No open jobs nearby right now."
                : isVerified
                  ? "Go online to see nearby jobs."
                  : "Jobs browsable now — accepting unlocks once verified."}
            </ThemedText>
          </Card>
        ) : (
          nearbyJobs.map((job) => (
            <Card key={job.id} style={styles.jobRow}>
              <ThemedText variant="body">
                {job.category.name}
                {job.distance_km !== null ? ` · ${job.distance_km}km` : ""}
              </ThemedText>
              <Badge
                label={`Est. N$${job.price_range_min}–${job.price_range_max}`}
                tone={isVerified ? "verified" : "neutral"}
              />
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    color: colors.textInverse,
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  onlineLabel: {
    color: colors.success,
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3EA",
    borderColor: "#FFE6D3",
  },
  bannerArrow: {
    color: colors.primary,
  },
  sectionTitle: {
    marginTop: spacing.xs,
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
