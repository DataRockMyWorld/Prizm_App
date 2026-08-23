import { getJob, JobRequest, useAuth } from "@prizm/api";
import { Avatar, Badge, Button, Card, colors, radii, Screen, spacing, ThemedText } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { formatJobStatusLabel, getStatusTone, StatusTone } from "../jobsTab/formatJobStatus";
import { computeJobDuration, formatFullDateTime } from "../jobsTab/jobDetailFormatting";

const TONE_COLORS: Record<StatusTone, string> = {
  active: colors.primary,
  waiting: colors.gold,
  success: colors.success,
  danger: colors.danger,
  neutral: colors.textSecondary,
};

/** Read-only summary of a past job, reached from the Jobs tab. No action
 * buttons here by design — status-changing actions live on the live
 * tracking screens (JobStatus/PriceAgreement), not here, so this can
 * never double-submit a transition. */
export function JobDetailScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const jobId: number = route.params.jobId;
  const [job, setJob] = useState<JobRequest | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getJob(accessToken, jobId)
      .then(setJob)
      .catch(() => {
        // leave job null — screen just shows the loading spinner
      });
  }, [accessToken, jobId]);

  if (!job) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </Screen>
    );
  }

  const toneColor = TONE_COLORS[getStatusTone(job.status)];
  const duration = computeJobDuration(job.accepted_at, job.updated_at);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">Job record</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Avatar uri={job.worker?.photo} size={72} />
          <ThemedText variant="title" style={styles.centered}>
            {job.worker?.full_name || "Your worker"}
          </ThemedText>
          <ThemedText variant="caption" style={styles.centered}>
            {job.category.name}
            {job.address ? ` · ${job.address}` : ""}
          </ThemedText>
          {job.worker?.verified && (
            <View style={styles.badgeRow}>
              <Badge label="✓ Verified" tone="verified" />
            </View>
          )}
          <View style={[styles.statusPill, { backgroundColor: `${toneColor}1A` }]}>
            <View style={[styles.statusDot, { backgroundColor: toneColor }]} />
            <ThemedText variant="caption" style={[styles.statusPillText, { color: toneColor }]}>
              {formatJobStatusLabel(job.status).toUpperCase()}
            </ThemedText>
          </View>
        </View>

        <Card style={styles.card}>
          <Row label="Completed" value={formatFullDateTime(job.updated_at)} />
          {!!duration && <Row label="Duration" value={duration} />}
        </Card>

        {!!job.description && (
          <Card style={styles.card}>
            <ThemedText variant="caption">Job</ThemedText>
            <ThemedText variant="body">{job.description}</ThemedText>
          </Card>
        )}

        <Card style={[styles.card, styles.priceCard]}>
          <View style={[styles.rail, { backgroundColor: toneColor }]} />
          <View style={styles.priceRow}>
            <View>
              <ThemedText variant="caption">FINAL PRICE</ThemedText>
              <ThemedText variant="title">
                {job.agreed_price
                  ? `N$${job.agreed_price}`
                  : `Est. N$${job.price_range_min}–${job.price_range_max}`}
              </ThemedText>
            </View>
            {!!job.agreed_price && (
              <ThemedText variant="caption" style={{ color: toneColor }}>
                {`Confirmed ${formatFullDateTime(job.updated_at)}`}
              </ThemedText>
            )}
          </View>
        </Card>

        <Card style={styles.card}>
          <ThemedText variant="caption">Your rating</ThemedText>
          {job.rating ? (
            <>
              <ThemedText variant="subtitle">{"★".repeat(job.rating.stars)}</ThemedText>
              {!!job.rating.comment && <ThemedText variant="body">{job.rating.comment}</ThemedText>}
              <ThemedText variant="caption" style={{ color: colors.textSecondary }}>
                {`You rated ${job.worker?.full_name || "your worker"}`}
              </ThemedText>
            </>
          ) : job.status === "completed" ? (
            <>
              <ThemedText variant="body" style={{ color: colors.textSecondary }}>
                You haven't rated this job yet.
              </ThemedText>
              <Button
                label="Rate this job"
                variant="secondary"
                onPress={() => navigation.navigate("Rating", { jobId })}
                style={styles.rateButton}
              />
            </>
          ) : (
            <ThemedText variant="body" style={{ color: colors.textSecondary }}>
              Not applicable.
            </ThemedText>
          )}
        </Card>

        <ThemedText variant="caption" style={[styles.footerNote, styles.centered]}>
          This job is closed. Records are kept for your reference.
        </ThemedText>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText variant="caption">{label}</ThemedText>
      <ThemedText variant="body">{value}</ThemedText>
    </View>
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
  identity: {
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  centered: {
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontWeight: "700",
    fontSize: 11,
  },
  card: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceCard: {
    overflow: "hidden",
    paddingLeft: spacing.md + 4,
  },
  rail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  rateButton: {
    marginTop: spacing.xs,
  },
  footerNote: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
