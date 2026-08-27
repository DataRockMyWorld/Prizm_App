import { JobRequest, getJob, useAuth } from "@prizm/api";
import { Avatar, Badge, Button, Card, Screen, ThemedText, colors, fontFamily, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "Matched">;

export function MatchedScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;
  const [job, setJob] = useState<JobRequest | null>(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    const poll = async () => {
      try {
        const data = await getJob(accessToken, jobId);
        setJob(data);
        if (navigatedRef.current) return;
        if (data.status === "searching") {
          navigatedRef.current = true;
          navigation.replace("Searching", { jobId });
        } else if (data.status === "cancelled") {
          navigatedRef.current = true;
          navigation.popToTop();
        }
      } catch {
        // transient poll failure — try again next tick
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [accessToken, jobId, navigation]);

  if (!job) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <ThemedText variant="title" style={styles.centered}>
          You've been matched!
        </ThemedText>

        <Card style={styles.workerCard}>
          <View style={styles.workerRow}>
            <Avatar uri={job.worker?.photo} size={52} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="subtitle">{job.worker?.full_name || "Your worker"}</ThemedText>
              {job.worker?.rating_average !== null && job.worker?.rating_average !== undefined && (
                <ThemedText variant="caption">⭐ {job.worker.rating_average}</ThemedText>
              )}
            </View>
          </View>
          {job.worker?.verified && (
            <View style={styles.badgeRow}>
              <Badge label="✓ Verified" tone="verified" />
            </View>
          )}
        </Card>

        <Card style={styles.requestCard}>
          <ThemedText variant="caption" style={styles.requestLabel}>
            Your request
          </ThemedText>
          <ThemedText variant="body">
            {job.category.name}
            {job.description ? ` · ${job.description}` : ""}
          </ThemedText>
          {job.address ? <ThemedText variant="caption">{job.address}</ThemedText> : null}
        </Card>

        <View style={styles.spacer} />
        <Button
          label="Confirm & Continue"
          onPress={() => navigation.replace("JobStatus", { jobId })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.xl,
  },
  content: {
    flex: 1,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  centered: {
    textAlign: "center",
  },
  workerCard: {
    gap: spacing.sm,
  },
  workerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  requestCard: {
    backgroundColor: colors.surfaceMuted,
    gap: 2,
  },
  requestLabel: {
    fontFamily: fontFamily.bold,
  },
  spacer: {
    flex: 1,
  },
});
