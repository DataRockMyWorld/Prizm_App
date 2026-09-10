import {
  ApiError,
  completeJob,
  getJob,
  JobRequest,
  markArrived,
  markInProgress,
  useAuth,
} from "@prizm/api";
import {
  Avatar,
  Button,
  Card,
  colors,
  fontFamily,
  radii,
  spacing,
  ThemedText,
} from "@prizm/ui";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";

import { openDirections } from "../activeJob/directions";
import { activeJobPhase, isCancelWindowOpen } from "../activeJob/statusTransitions";

const CANCEL_RECHECK_INTERVAL_MS = 15000;

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "detail" in error.data) {
    return String((error.data as { detail: unknown }).detail);
  }
  return fallback;
}

/** The worker's active-job screen (v2 flow — docs/prds/active-job-flow-v2.md).
 * Renders one of four phases by job status:
 *  - accepted       → heading there ("I've arrived")
 *  - arrived        → on-site evaluate ("Accept & send quote" / "Decline")
 *  - quote_accepted → ready to start ("Start work")
 *  - in_progress    → work in progress ("Complete job")
 * quote_pending routes to WaitingForConfirmation; terminal → JobDetail. */
export function ActiveJobScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const jobId: number = route.params.jobId;

  const [job, setJob] = useState<JobRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const loadJob = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await getJob(accessToken, jobId);
      setJob(data);
      // A job that moved off ActiveJob's phases while the worker was away
      // (customer confirmed the quote and it's now waiting to start is
      // still here; but quote_pending / terminal are not).
      if (data.status === "quote_pending") {
        navigation.replace("WaitingForConfirmation", { jobId });
      } else if (activeJobPhase(data.status) === null) {
        navigation.replace("JobDetail", { jobId });
      }
    } catch {
      // leave job as-is — screen just won't render until this loads
    }
  }, [accessToken, jobId, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadJob();
    }, [loadJob])
  );

  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(() => setNow(new Date()), CANCEL_RECHECK_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [])
  );

  if (!job || !accessToken) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const phase = activeJobPhase(job.status);

  const run = async (fn: () => Promise<JobRequest>, onDone: (j: JobRequest) => void) => {
    if (busy) return;
    setBusy(true);
    try {
      onDone(await fn());
    } catch (error) {
      Alert.alert("Something went wrong", apiErrorMessage(error, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const customerName = job.customer?.full_name || "Customer";
  const firstName = customerName.split(" ")[0];

  const customerCard = (
    <Card style={styles.customerCard}>
      <Avatar uri={job.customer?.photo} size={38} />
      <View style={styles.customerInfo}>
        <ThemedText variant="subtitle">{customerName}</ThemedText>
        <ThemedText variant="caption">{job.address}</ThemedText>
      </View>
      {job.worker?.rating_average != null && (
        <ThemedText variant="caption">★ {job.worker.rating_average.toFixed(1)}</ThemedText>
      )}
    </Card>
  );

  const detailsCard = (
    <Card style={styles.detailsCard}>
      <ThemedText variant="caption">Job details</ThemedText>
      <ThemedText variant="body">
        {job.category.name}
        {job.description ? ` · ${job.description}` : ""}
      </ThemedText>
    </Card>
  );

  const agreedChip = job.agreed_price ? (
    <View style={styles.agreedChip}>
      <ThemedText variant="caption" style={styles.agreedLabel}>
        Agreed
      </ThemedText>
      <ThemedText variant="subtitle">N${job.agreed_price}</ThemedText>
    </View>
  ) : null;

  const header = (title: string) => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {/* The job keeps running and is reachable from the Jobs tab, so
            this isn't a dead end — it's a deliberate "step away" exit. */}
        <Pressable
          onPress={() => navigation.navigate("Tabs")}
          hitSlop={12}
          accessibilityLabel="Back to Jobs"
        >
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="title">{title}</ThemedText>
      </View>
      <Pressable
        onPress={() => navigation.navigate("Chat", { jobId })}
        style={styles.chatButton}
        accessibilityLabel="Chat"
      >
        <ThemedText>💬</ThemedText>
      </Pressable>
    </View>
  );

  // --- accepted: heading there -----------------------------------------
  if (phase === "heading_there") {
    const showCancel = isCancelWindowOpen(job.accepted_at, now);
    return (
      <View style={styles.container}>
        {header("Active job")}
        <StatusPill label="HEADING OVER" />
        {customerCard}
        <Button
          label="Get Directions"
          variant="secondary"
          onPress={() => openDirections(job.address, job.latitude, job.longitude)}
        />
        {detailsCard}
        <ThemedText variant="caption" style={styles.helperText}>
          You'll agree the price with {firstName} on site, once you've seen the job.
        </ThemedText>
        <View style={styles.spacer} />
        <Button
          label="I've arrived"
          loading={busy}
          onPress={() =>
            run(
              () => markArrived(accessToken, jobId),
              (j) => setJob(j)
            )
          }
        />
        {showCancel && (
          <Pressable onPress={() => navigation.navigate("CancelJob", { jobId })} style={styles.linkRow}>
            <ThemedText variant="caption" style={styles.dangerLink}>
              Cancel job
            </ThemedText>
          </Pressable>
        )}
      </View>
    );
  }

  // --- arrived: on-site evaluate --------------------------------------
  if (phase === "evaluate") {
    return (
      <View style={styles.container}>
        {header("On site")}
        <StatusPill label="EVALUATING" />
        <View>
          <ThemedText variant="title">Assess the job</ThemedText>
          <ThemedText variant="caption" style={styles.helperText}>
            Look over the work, agree a price with the customer, then send your quote.
          </ThemedText>
        </View>
        {customerCard}
        {detailsCard}
        <Card style={styles.detailsCard}>
          <ThemedText variant="caption">Customer's estimate</ThemedText>
          <ThemedText variant="body">
            N${job.price_range_min}–{job.price_range_max} · guide only
          </ThemedText>
        </Card>
        <View style={styles.spacer} />
        <Button label="Accept & send quote" onPress={() => navigation.navigate("SendQuote", { jobId })} />
        <Button
          label="Decline this job"
          variant="secondary"
          onPress={() => navigation.navigate("DeclineJob", { jobId })}
          style={styles.declineButton}
        />
      </View>
    );
  }

  // --- quote_accepted: ready to start --------------------------------
  if (phase === "ready_to_start") {
    return (
      <View style={styles.container}>
        {header("Active job")}
        <StatusPill label="QUOTE ACCEPTED" />
        <View>
          <ThemedText variant="title">{firstName} confirmed your price</ThemedText>
          <ThemedText variant="caption" style={styles.helperText}>
            You're clear to begin whenever you're ready.
          </ThemedText>
        </View>
        {customerCard}
        {agreedChip}
        {detailsCard}
        <View style={styles.spacer} />
        <Button
          label="Start work"
          loading={busy}
          onPress={() =>
            run(
              () => markInProgress(accessToken, jobId),
              (j) => setJob(j)
            )
          }
        />
      </View>
    );
  }

  // --- in_progress: work in progress --------------------------------
  return (
    <View style={styles.container}>
      {header("Job in progress")}
      {agreedChip}
      {customerCard}
      {detailsCard}
      <View style={styles.spacer} />
      <Button
        label="Complete job"
        loading={busy}
        onPress={() =>
          run(
            () => completeJob(accessToken, jobId),
            () => navigation.replace("JobComplete", { jobId })
          )
        }
      />
      {/* No worker-side job-outcome report flow exists yet (only the
          chat-safety ReportChat). "Need to stop" mid-job = talk to the
          customer; a dedicated worker report flow is out of scope here. */}
      <Pressable onPress={() => navigation.navigate("Chat", { jobId })} style={styles.linkRow}>
        <ThemedText variant="caption" style={styles.mutedLink}>
          Need to stop? Message {firstName}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <ThemedText variant="caption" style={styles.pillText}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    flex: 1,
    backgroundColor: colors.pageBackground,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chatButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
  },
  pillText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  customerInfo: { flex: 1 },
  detailsCard: { gap: spacing.xs },
  agreedChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  agreedLabel: { color: colors.textSecondary },
  helperText: { marginTop: spacing.xs },
  spacer: { flex: 1 },
  linkRow: { alignItems: "center", paddingVertical: spacing.xs },
  declineButton: { marginTop: spacing.xs },
  dangerLink: { color: colors.primary, fontFamily: fontFamily.bold },
  mutedLink: { color: colors.textSecondary, fontFamily: fontFamily.bold },
});
