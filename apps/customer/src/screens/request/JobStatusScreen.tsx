import { JobRequest, JobStatus, getJob, useAuth } from "@prizm/api";
import { Avatar, Card, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "JobStatus">;

const STEP_LABELS = ["Requested", "Accepted", "In progress", "Complete"];

function stepIndexForStatus(status: JobStatus): number {
  switch (status) {
    case "accepted":
    case "on_my_way":
    case "arrived":
    case "in_progress":
      return 2;
    case "awaiting_price_confirmation":
    case "completed":
      return 3;
    default:
      return 1;
  }
}

function subtextForStatus(status: JobStatus): string {
  switch (status) {
    case "on_my_way":
      return "Worker is on the way";
    case "arrived":
      return "Worker has arrived";
    case "in_progress":
      return "Worker on site";
    default:
      return "Waiting for worker to start";
  }
}

export function JobStatusScreen({ navigation, route }: Props) {
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
        if (data.status === "awaiting_price_confirmation") {
          navigatedRef.current = true;
          navigation.replace("PriceAgreement", { jobId });
        } else if (data.status === "cancelled" || data.status === "disputed") {
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

  const currentIndex = stepIndexForStatus(job.status);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">Job status</ThemedText>
        <View style={styles.chatIcon}>
          <ThemedText>💬</ThemedText>
        </View>
      </View>

      <Card style={styles.workerCard}>
        <Avatar uri={job.worker?.photo} size={38} />
        <View style={{ flex: 1 }}>
          <ThemedText variant="subtitle">{job.worker?.full_name || "Your worker"}</ThemedText>
          <ThemedText variant="caption">
            {job.category.name}
            {job.description ? ` · ${job.description}` : ""}
          </ThemedText>
        </View>
      </Card>

      <View style={styles.stepper}>
        {STEP_LABELS.map((label, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <View key={label} style={styles.stepRow}>
              <View style={styles.stepDotColumn}>
                <View
                  style={[
                    styles.stepDot,
                    isDone && styles.stepDotDone,
                    isCurrent && styles.stepDotCurrent,
                  ]}
                >
                  {isDone && <ThemedText style={styles.stepCheck}>✓</ThemedText>}
                </View>
                {index < STEP_LABELS.length - 1 && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </View>
              <View style={styles.stepTextColumn}>
                <ThemedText
                  variant="body"
                  style={isCurrent ? styles.stepLabelCurrent : !isDone ? styles.stepLabelPending : undefined}
                >
                  {label}
                </ThemedText>
                {isCurrent && (
                  <ThemedText variant="caption">{subtextForStatus(job.status)}</ThemedText>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.spacer} />
      <Pressable onPress={() => navigation.navigate("ReportProblem", { jobId })}>
        <ThemedText variant="body" style={styles.reportLink}>
          Report a problem
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  chatIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  workerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepper: {
    gap: 0,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stepDotColumn: {
    alignItems: "center",
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotCurrent: {
    borderColor: colors.primary,
  },
  stepCheck: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: "700",
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: colors.border,
  },
  stepLineDone: {
    backgroundColor: colors.primary,
  },
  stepTextColumn: {
    paddingBottom: spacing.md,
  },
  stepLabelCurrent: {
    color: colors.primary,
    fontWeight: "700",
  },
  stepLabelPending: {
    color: colors.textSecondary,
  },
  spacer: {
    flex: 1,
  },
  reportLink: {
    textAlign: "center",
    color: colors.primary,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
});
