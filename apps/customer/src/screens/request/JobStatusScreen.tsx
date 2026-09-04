import { JobRequest, JobStatus, getJob, useAuth } from "@prizm/api";
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
import { formatClockTime } from "../../request/formatClockTime";
import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "JobStatus">;

// Each real backend status (see CLAUDE.md's job lifecycle) gets its own
// row now, instead of on_my_way/arrived/in_progress collapsing into a
// single "In progress" row whose subtext silently changed underneath it —
// a customer glancing at the screen mid-job couldn't tell how far along
// things actually were without re-reading the caption every time.
const STEP_LABELS = ["Requested", "Accepted", "On my way", "Arrived", "Job started", "Complete"];

// How long the "awaiting_price_confirmation" beat holds on this screen,
// showing every row (including "Complete") ticked, before handing off to
// PriceAgreement — previously that redirect fired in the same poll tick
// that discovered the status change, so the customer never actually saw
// "Complete" reached at all.
const COMPLETE_PAUSE_MS = 1800;

// Index of the MOST RECENTLY REACHED step — every step up to and
// including this one is ticked done, later ones are pending. This one
// also gets the accent-color "current" treatment, to draw the eye to
// what just happened.
//
// Deliberately NOT "the next step we're waiting on" (an earlier version
// of this did that, e.g. showing "On my way" lit up while the worker was
// still just sitting on "accepted") — that reads fine for a vague label
// like the old "In progress" bucket, but for concrete action labels like
// "On my way"/"Arrived" it makes a false claim about something that
// hasn't happened yet. A step only lights up once its own status is
// actually true.
function reachedStepIndex(status: JobStatus): number {
  switch (status) {
    case "accepted":
      return 1;
    case "on_my_way":
      return 2;
    case "arrived":
      return 3;
    case "in_progress":
      return 4;
    case "awaiting_price_confirmation":
    case "completed":
      return STEP_LABELS.length - 1; // "Complete" — every row ticked
    default: // requested, searching, matched — nothing beyond the request itself yet
      return 0;
  }
}

// The ISO timestamp backing each step, in the same order as STEP_LABELS —
// "Complete" has no dedicated field (the transient pause is too brief to
// need one) so it's always null.
function timestampForStep(index: number, job: JobRequest): string | null {
  const isoByIndex = [job.created_at, job.accepted_at, job.on_my_way_at, job.arrived_at, job.started_at, null];
  const iso = isoByIndex[index];
  return iso ? formatClockTime(iso) : null;
}

function firstName(fullName: string | null | undefined): string {
  return (fullName || "Your worker").split(" ")[0];
}

function headlineForStatus(status: JobStatus, name: string): string {
  switch (status) {
    case "accepted":
      return `${name} accepted your request`;
    case "on_my_way":
      return `${name} is on the way`;
    case "arrived":
      return `${name} has arrived`;
    case "in_progress":
      return `${name} started the job`;
    case "awaiting_price_confirmation":
    case "completed":
      return `${name} completed the job`;
    default:
      return `Waiting for ${name} to accept`;
  }
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
        if (data.status === "awaiting_price_confirmation") {
          navigatedRef.current = true;
          completeTimerRef.current = setTimeout(() => {
            navigation.replace("PriceAgreement", { jobId });
          }, COMPLETE_PAUSE_MS);
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

  const reachedIndex = reachedStepIndex(job.status);
  const workerName = firstName(job.worker?.full_name);
  const ratingPart = job.worker?.rating_average != null ? ` · ${job.worker.rating_average} ★` : "";
  const jobsPart = job.worker?.jobs_completed ? ` · ${job.worker.jobs_completed} jobs` : "";

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
                  {formatJobStatusLabel(job.status).toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText variant="title" style={styles.heroHeadline}>
                {headlineForStatus(job.status, workerName)}
              </ThemedText>
            </View>
            <View style={styles.stepCountCircle}>
              <ThemedText style={styles.stepCountNumber}>{reachedIndex + 1}</ThemedText>
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
              const isReached = index <= reachedIndex;
              const isLatest = index === reachedIndex;
              const timestamp = timestampForStep(index, job);
              return (
                <View key={label} style={styles.timelineRow}>
                  <View style={styles.timelineDotColumn}>
                    <View
                      style={[
                        styles.timelineDot,
                        isReached && styles.timelineDotDone,
                        isLatest && styles.timelineDotLatest,
                      ]}
                    >
                      {isReached && <ThemedText style={styles.timelineCheck}>✓</ThemedText>}
                    </View>
                    {index < STEP_LABELS.length - 1 && (
                      <View style={[styles.timelineLine, index < reachedIndex && styles.timelineLineDone]} />
                    )}
                  </View>
                  <View style={styles.timelineTextColumn}>
                    <ThemedText
                      variant="body"
                      style={
                        isLatest
                          ? styles.timelineLabelLatest
                          : !isReached
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
                  </View>
                </View>
              );
            })}
          </Card>

          <Card style={styles.detailCard}>
            <View style={styles.detailRow}>
              <ThemedText variant="caption" style={styles.detailLabel}>
                ESTIMATE
              </ThemedText>
              <ThemedText variant="subtitle">
                N${job.price_range_min}–{job.price_range_max}
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

          {job.status === "awaiting_price_confirmation" && (
            <View style={styles.continuingRow}>
              <ActivityIndicator color={colors.textSecondary} size="small" />
              <ThemedText variant="caption">Job complete — getting the price ready…</ThemedText>
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
  // Pulls the worker card up to overlap the gradient hero's rounded
  // bottom edge (approved hi-fi) — the negative margin needs to be less
  // than the hero's own paddingBottom so the card doesn't creep onto the
  // gradient text above it.
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
    // colors.border (#ECE7E2) against pageBackground (#F1ECE7) is nearly
    // indistinguishable — same contrast bug already fixed for PinDots and
    // the rating stars this session.
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // Extra ring on top of the normal filled/ticked dot — marks which
  // reached step is the *freshest* one, so a customer glancing back at
  // this screen mid-job can immediately spot what just happened instead
  // of having to compare every row's fill state.
  timelineDotLatest: {
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
