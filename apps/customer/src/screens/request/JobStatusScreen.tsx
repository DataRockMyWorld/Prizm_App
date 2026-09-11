import { JobRequest, getJob, useAuth } from "@prizm/api";
import {
  Avatar,
  Card,
  GradientBackground,
  Screen,
  ThemedText,
  colors,
  fontFamily,
  radii,
  spacing,
} from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { formatJobStatusLabel } from "../../jobsTab/formatJobStatus";
import type { RequestStackParamList } from "../../navigation/types";
import {
  STEP_LABELS,
  headlineForStatus,
  timelineState,
  timestampForStep,
} from "../../request/jobStatusSteps";

type Props = NativeStackScreenProps<RequestStackParamList, "JobStatus">;

// How long the "completed" beat holds — every row (including "Complete")
// ticked — before handing off to Rating, so the customer actually sees the
// timeline finish rather than being yanked straight to the star picker.
const COMPLETE_PAUSE_MS = 1800;

function firstName(fullName: string | null | undefined): string {
  return (fullName || "Your worker").split(" ")[0];
}

export function JobStatusScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;
  const [job, setJob] = useState<JobRequest | null>(null);
  const navigatedRef = useRef(false);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const poll = async () => {
      try {
        const data = await getJob(accessToken, jobId);
        setJob(data);
        if (navigatedRef.current) return;
        if (data.status === "completed") {
          navigatedRef.current = true;
          completeTimerRef.current = setTimeout(() => {
            navigation.replace("Rating", { jobId });
          }, COMPLETE_PAUSE_MS);
        } else if (data.status === "declined") {
          navigatedRef.current = true;
          navigation.replace("WorkerDeclined", { jobId });
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
    return () => {
      clearInterval(interval);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, [accessToken, jobId, navigation]);

  if (!job) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </Screen>
    );
  }

  const { lastDone, current } = timelineState(job.status);
  const workerName = firstName(job.worker?.full_name);
  const ratingPart = job.worker?.rating_average != null ? ` · ${job.worker.rating_average} ★` : "";
  const jobsPart = job.worker?.jobs_completed ? ` · ${job.worker.jobs_completed} jobs` : "";
  const awaitingQuote = job.status === "quote_pending";
  const hasQuote = job.agreed_price != null;

  const goToConfirmQuote = () => navigation.navigate("ConfirmQuote", { jobId });

  return (
    <Screen style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <GradientBackground style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <ThemedText variant="title" style={styles.heroChevron}>
                ‹
              </ThemedText>
            </Pressable>
            <ThemedText variant="caption" style={styles.heroJobLabel}>
              JOB #{job.id}
            </ThemedText>
            <Pressable
              onPress={() => navigation.navigate("ReportProblem", { jobId })}
              style={styles.heroHelpButton}
              hitSlop={8}
              accessibilityLabel="Report a problem"
            >
              <ThemedText style={styles.heroHelpText}>?</ThemedText>
            </Pressable>
          </View>

          <View style={styles.heroBottomRow}>
            <View style={styles.heroTextColumn}>
              <View style={styles.statusPill}>
                <View style={styles.statusPillDot} />
                <ThemedText style={styles.statusPillText}>
                  {(awaitingQuote ? "Quote ready" : formatJobStatusLabel(job.status)).toUpperCase()}
                </ThemedText>
              </View>
              <Pressable onPress={awaitingQuote ? goToConfirmQuote : undefined} disabled={!awaitingQuote}>
                <ThemedText variant="title" style={styles.heroHeadline}>
                  {headlineForStatus(job.status, workerName)}
                </ThemedText>
              </Pressable>
              {awaitingQuote && (
                <ThemedText style={styles.heroSubline}>
                  N${job.agreed_price} quoted · tap to review
                </ThemedText>
              )}
            </View>
            <View style={styles.stepCountCircle}>
              <ThemedText style={styles.stepCountNumber}>{current + 1}</ThemedText>
              <ThemedText style={styles.stepCountLabel}>OF {STEP_LABELS.length}</ThemedText>
            </View>
          </View>
        </GradientBackground>

        <View style={styles.body}>
          <Card style={[styles.workerCard, styles.floatingCard]}>
            <Avatar uri={job.worker?.photo} size={44} />
            <View style={styles.workerInfo}>
              <ThemedText variant="subtitle" numberOfLines={1}>
                {job.worker?.full_name || "Your worker"}
              </ThemedText>
              <ThemedText variant="caption" numberOfLines={1}>
                {job.category.name}
                {ratingPart}
                {jobsPart}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => navigation.navigate("Chat", { jobId })}
              style={styles.chatButton}
              accessibilityLabel="Chat"
            >
              <ThemedText style={styles.chatButtonText}>💬</ThemedText>
            </Pressable>
          </Card>

          <Card style={styles.progressCard}>
            <ThemedText variant="caption" style={styles.progressLabel}>
              PROGRESS
            </ThemedText>
            {STEP_LABELS.map((label, index) => {
              const isDone = index <= lastDone;
              const isCurrent = index === current;
              const timestamp = timestampForStep(index, job);
              const subtext =
                isCurrent && awaitingQuote && index === current
                  ? `Waiting for you to confirm N$${job.agreed_price}`
                  : null;
              return (
                <View key={label} style={styles.timelineRow}>
                  <View style={styles.timelineDotColumn}>
                    <View
                      style={[
                        styles.timelineDot,
                        isDone && styles.timelineDotDone,
                        isCurrent && styles.timelineDotLatest,
                      ]}
                    >
                      {isDone && <ThemedText style={styles.timelineCheck}>✓</ThemedText>}
                    </View>
                    {index < STEP_LABELS.length - 1 && (
                      <View style={[styles.timelineLine, index < lastDone && styles.timelineLineDone]} />
                    )}
                  </View>
                  <View style={styles.timelineTextColumn}>
                    <ThemedText
                      variant="body"
                      style={
                        isCurrent
                          ? styles.timelineLabelLatest
                          : !isDone
                            ? styles.timelineLabelPending
                            : undefined
                      }
                    >
                      {label}
                    </ThemedText>
                    {timestamp && (
                      <ThemedText variant="caption" style={styles.timelineTimestamp}>
                        {timestamp}
                      </ThemedText>
                    )}
                    {subtext && (
                      <ThemedText variant="caption" style={styles.timelineTimestamp}>
                        {subtext}
                      </ThemedText>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>

          <Card style={styles.detailCard}>
            <View style={styles.detailRow}>
              <ThemedText variant="caption" style={styles.detailLabel}>
                {hasQuote ? "QUOTED" : "ESTIMATE"}
              </ThemedText>
              <ThemedText variant="subtitle">
                {hasQuote ? `N$${job.agreed_price}` : `N$${job.price_range_min}–${job.price_range_max}`}
              </ThemedText>
            </View>
            <View style={styles.detailDivider} />
            <View>
              <ThemedText variant="caption" style={styles.detailLabel}>
                ADDRESS
              </ThemedText>
              <ThemedText variant="body">{job.address || "—"}</ThemedText>
            </View>
          </Card>

          {awaitingQuote && (
            <Pressable onPress={goToConfirmQuote} style={styles.reviewButton}>
              <ThemedText style={styles.reviewButtonText}>Review the quote</ThemedText>
            </Pressable>
          )}

          {job.status === "completed" && (
            <View style={styles.continuingRow}>
              <ActivityIndicator color={colors.textSecondary} size="small" />
              <ThemedText variant="caption">Job complete — wrapping up…</ThemedText>
            </View>
          )}

          <Pressable onPress={() => navigation.navigate("ReportProblem", { jobId })}>
            <ThemedText variant="body" style={styles.reportLink}>
              Report a problem
            </ThemedText>
          </Pressable>
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
  loading: {
    marginTop: spacing.xl,
  },
  hero: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroChevron: {
    color: colors.textInverse,
  },
  heroJobLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontFamily: fontFamily.bold,
    letterSpacing: 1,
  },
  heroHelpButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroHelpText: {
    color: colors.textInverse,
    fontFamily: fontFamily.bold,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroTextColumn: {
    flex: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textInverse,
  },
  statusPillText: {
    color: colors.textInverse,
    fontSize: 10,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.5,
  },
  heroHeadline: {
    color: colors.textInverse,
    marginTop: spacing.sm,
  },
  heroSubline: {
    color: "rgba(255, 255, 255, 0.9)",
    fontFamily: fontFamily.bold,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  stepCountCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCountNumber: {
    color: colors.textInverse,
    fontFamily: fontFamily.bold,
    fontSize: 15,
  },
  stepCountLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 7,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.5,
  },
  body: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  floatingCard: {
    marginTop: -spacing.xl,
  },
  workerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  workerInfo: {
    flex: 1,
  },
  chatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  chatButtonText: {
    fontSize: 15,
  },
  progressCard: {
    gap: 0,
  },
  progressLabel: {
    fontFamily: fontFamily.bold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  timelineDotColumn: {
    alignItems: "center",
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timelineDotLatest: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  timelineCheck: {
    color: colors.textInverse,
    fontSize: 11,
    fontFamily: fontFamily.bold,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: colors.border,
  },
  timelineLineDone: {
    backgroundColor: colors.primary,
  },
  timelineTextColumn: {
    paddingBottom: spacing.md,
    flex: 1,
  },
  timelineLabelLatest: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
  },
  timelineLabelPending: {
    color: colors.textSecondary,
  },
  timelineTimestamp: {
    marginTop: 1,
  },
  detailCard: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontFamily: fontFamily.bold,
    letterSpacing: 1,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  reviewButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  reviewButtonText: {
    color: colors.textInverse,
    fontFamily: fontFamily.extraBold,
  },
  continuingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  reportLink: {
    textAlign: "center",
    color: colors.danger,
    fontFamily: fontFamily.bold,
  },
});
