import {
  ApiError,
  getJob,
  JobRequest,
  JobStatus,
  markArrived,
  markInProgress,
  markOnMyWay,
  useAuth,
} from "@prizm/api";
import {
  Avatar,
  Button,
  Card,
  colors,
  GradientBackground,
  radii,
  spacing,
  ThemedText,
} from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";

import { openDirections } from "../activeJob/directions";
import { getNextValidStatus, isCancelWindowOpen } from "../activeJob/statusTransitions";

const CANCEL_RECHECK_INTERVAL_MS = 15000;

const SEGMENTS: { status: JobStatus; label: string }[] = [
  { status: "on_my_way", label: "On my way" },
  { status: "arrived", label: "Arrived" },
  { status: "in_progress", label: "In progress" },
];

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "detail" in error.data) {
    return String((error.data as { detail: unknown }).detail);
  }
  return fallback;
}

/** W2 / W2b — active job: customer card, directions, the on-site status
 * stepper, and entry points to mark-complete / cancel (both still
 * placeholders — T5a and T5b build the real screens). */
export function ActiveJobScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const jobId: number = route.params.jobId;

  const [job, setJob] = useState<JobRequest | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const loadJob = useCallback(async () => {
    if (!accessToken) return;
    try {
      setJob(await getJob(accessToken, jobId));
    } catch {
      // leave job as-is — screen just won't render until this loads
    }
  }, [accessToken, jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  // Re-check the cancel window periodically so the "Cancel job" link
  // disappears on its own once the 10-minute window passes, without
  // needing a screen refresh.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), CANCEL_RECHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!job || !accessToken) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const nextStatus = getNextValidStatus(job.status);
  const highlightedStatus = job.status === "accepted" ? "on_my_way" : job.status;

  const handleTransition = async (status: JobStatus) => {
    if (status !== nextStatus || isTransitioning) return;
    setIsTransitioning(true);
    try {
      const transition = status === "on_my_way" ? markOnMyWay : status === "arrived" ? markArrived : markInProgress;
      setJob(await transition(accessToken, jobId));
    } catch (error) {
      Alert.alert("Couldn't update status", apiErrorMessage(error, "Something went wrong."));
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleMarkComplete = () => {
    // TODO(T5b): navigate to the real propose-price screen once it exists.
    Alert.alert("Coming soon", "Proposing a price will be built in a follow-up ticket.");
  };

  const handleCancel = () => {
    // TODO(T5a): navigate to the real cancel-job screen once it exists.
    Alert.alert("Coming soon", "Cancelling will be built in a follow-up ticket.");
  };

  const showMarkComplete = job.status === "in_progress";
  const showCancel = isCancelWindowOpen(job.accepted_at, now);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText variant="title">Active job</ThemedText>
        <Pressable
          onPress={() => Alert.alert("Chat coming soon")}
          style={styles.chatButton}
          accessibilityLabel="Chat (coming soon)"
        >
          <ThemedText>💬</ThemedText>
        </Pressable>
      </View>

      <Card style={styles.customerCard}>
        <Avatar uri={job.customer?.photo} size={38} />
        <View style={styles.customerInfo}>
          <ThemedText variant="subtitle">{job.customer?.full_name || "Customer"}</ThemedText>
          <ThemedText variant="caption">{job.address}</ThemedText>
        </View>
      </Card>

      <Button
        label="Get Directions"
        variant="secondary"
        onPress={() => openDirections(job.address, job.latitude, job.longitude)}
      />

      <View>
        <ThemedText variant="caption" style={styles.sectionLabel}>
          Update status
        </ThemedText>
        <View style={styles.segmentRow}>
          {SEGMENTS.map((segment) => {
            const isActive = segment.status === highlightedStatus;
            const isTappable = segment.status === nextStatus && !isTransitioning;
            const content = (
              <ThemedText
                variant="caption"
                style={isActive ? styles.segmentTextActive : styles.segmentText}
              >
                {segment.label}
              </ThemedText>
            );
            return (
              <Pressable
                key={segment.status}
                disabled={!isTappable}
                onPress={() => handleTransition(segment.status)}
                style={styles.segmentWrapper}
              >
                {isActive ? (
                  <GradientBackground style={styles.segment}>{content}</GradientBackground>
                ) : (
                  <View style={styles.segment}>{content}</View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card style={styles.detailsCard}>
        <ThemedText variant="caption">Job details</ThemedText>
        <ThemedText variant="body">
          {job.category.name}
          {job.description ? ` · ${job.description}` : ""}
        </ThemedText>
      </Card>

      {showMarkComplete && (
        <Button label="Mark Job Complete" variant="primary" onPress={handleMarkComplete} />
      )}

      {showCancel && (
        <Pressable onPress={handleCancel} style={styles.cancelLink}>
          <ThemedText variant="caption" style={styles.cancelText}>
            Cancel job
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  customerInfo: {
    flex: 1,
  },
  sectionLabel: {
    marginBottom: spacing.xs,
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.xs / 2,
    gap: spacing.xs / 2,
  },
  segmentWrapper: {
    flex: 1,
  },
  segment: {
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: colors.textInverse,
    fontWeight: "800",
  },
  detailsCard: {
    gap: spacing.xs,
  },
  cancelLink: {
    alignItems: "center",
    marginTop: "auto",
  },
  cancelText: {
    color: colors.primary,
    fontWeight: "700",
  },
});
