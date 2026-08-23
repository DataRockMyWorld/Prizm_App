import { JobRequest, listMyJobs, useAuth } from "@prizm/api";
import { Avatar, Button, Card, colors, radii, Screen, spacing, ThemedText } from "@prizm/ui";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { formatJobStatusLabel, getPriceCaption, getStatusTone, StatusTone } from "../jobsTab/formatJobStatus";
import {
  computeAgreedTotalThisMonth,
  formatJobCardDate,
  groupByRecency,
  isActiveJobStatus,
} from "../jobsTab/jobsTabGrouping";
import { getJobsTabRoute } from "../jobsTab/jobsTabRouting";
import { sortJobsNewestFirst } from "../jobsTab/sortJobs";

type Tab = "active" | "completed";

const TONE_COLORS: Record<StatusTone, string> = {
  active: colors.primary,
  waiting: colors.gold,
  success: colors.success,
  danger: colors.danger,
  neutral: colors.textSecondary,
};

/** Job history — refetches whenever the tab regains focus, since a job's
 * status can change elsewhere (accept, cancel, complete) while this tab
 * isn't visible. Tapping a still-active job routes into the real live
 * screen rather than a static summary — see getJobsTabRoute. */
export function JobsScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const [jobs, setJobs] = useState<JobRequest[] | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  const loadJobs = useCallback(async () => {
    if (!accessToken) return;
    try {
      setJobs(sortJobsNewestFirst(await listMyJobs(accessToken)));
    } catch {
      setJobs([]);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [loadJobs])
  );

  const handlePress = (job: JobRequest) => {
    navigation.navigate(getJobsTabRoute(job.status), { jobId: job.id });
  };

  const activeJobs = jobs?.filter((job) => isActiveJobStatus(job.status)) ?? [];
  const completedJobs = jobs?.filter((job) => !isActiveJobStatus(job.status)) ?? [];
  const { thisWeek, earlier } = groupByRecency(completedJobs);
  const agreedThisMonth = computeAgreedTotalThisMonth(completedJobs);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <ThemedText variant="title">Jobs</ThemedText>
        <ThemedText variant="caption">
          {tab === "active"
            ? `${activeJobs.length} active`
            : `N$${agreedThisMonth} agreed this month`}
        </ThemedText>
      </View>

      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setTab("active")}
          style={[styles.segment, tab === "active" && styles.segmentActive]}
        >
          <ThemedText variant="caption" style={tab === "active" ? styles.segmentTextActive : undefined}>
            Active
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setTab("completed")}
          style={[styles.segment, tab === "completed" && styles.segmentActive]}
        >
          <ThemedText
            variant="caption"
            style={tab === "completed" ? styles.segmentTextActive : undefined}
          >
            Completed
          </ThemedText>
        </Pressable>
      </View>

      {jobs === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : tab === "active" ? (
        activeJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <ThemedText style={styles.emptyIcon}>🧰</ThemedText>
            </View>
            <ThemedText variant="subtitle" style={styles.centered}>
              No active jobs
            </ThemedText>
            <ThemedText variant="caption" style={styles.centered}>
              When a customer nearby books your service, the request lands here. Keep your
              availability on to get matched faster.
            </ThemedText>
            <Button
              label="Check availability"
              variant="secondary"
              onPress={() => navigation.navigate("Tabs", { screen: "Home" })}
              style={styles.emptyButton}
            />
          </View>
        ) : (
          activeJobs.map((job) => <JobCard key={job.id} job={job} onPress={handlePress} />)
        )
      ) : completedJobs.length === 0 ? (
        <Card>
          <ThemedText variant="subtitle">No completed jobs yet</ThemedText>
          <ThemedText variant="caption">Jobs you finish will show up here.</ThemedText>
        </Card>
      ) : (
        <>
          {thisWeek.length > 0 && (
            <>
              <ThemedText variant="caption" style={styles.sectionLabel}>
                THIS WEEK
              </ThemedText>
              {thisWeek.map((job) => (
                <JobCard key={job.id} job={job} onPress={handlePress} />
              ))}
            </>
          )}
          {earlier.length > 0 && (
            <>
              <ThemedText variant="caption" style={styles.sectionLabel}>
                EARLIER
              </ThemedText>
              {earlier.map((job) => (
                <JobCard key={job.id} job={job} onPress={handlePress} />
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function JobCard({ job, onPress }: { job: JobRequest; onPress: (job: JobRequest) => void }) {
  const toneColor = TONE_COLORS[getStatusTone(job.status)];
  const priceCaption = getPriceCaption(job.status);

  return (
    <Pressable onPress={() => onPress(job)}>
      <Card style={styles.jobCard}>
        <View style={[styles.rail, { backgroundColor: toneColor }]} />
        <Avatar uri={job.customer?.photo} size={38} />
        <View style={styles.jobInfo}>
          <ThemedText variant="subtitle" numberOfLines={1}>
            {job.customer?.full_name || "Customer"}
          </ThemedText>
          <ThemedText variant="caption" numberOfLines={1} ellipsizeMode="tail">
            {job.category.name}
            {job.description ? ` · ${job.description}` : ""}
          </ThemedText>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: toneColor }]} />
            <ThemedText variant="caption" style={[styles.statusLabel, { color: toneColor }]}>
              {formatJobStatusLabel(job.status).toUpperCase()}
            </ThemedText>
          </View>
        </View>
        <View style={styles.jobMeta}>
          <ThemedText variant="subtitle">
            {job.agreed_price
              ? `N$${job.agreed_price}`
              : `Est. N$${job.price_range_min}–${job.price_range_max}`}
          </ThemedText>
          {!!priceCaption && (
            <ThemedText variant="caption" style={{ color: toneColor }}>
              {priceCaption}
            </ThemedText>
          )}
          <ThemedText variant="caption">{formatJobCardDate(job.created_at)}</ThemedText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 3,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: "center",
    borderRadius: radii.sm,
  },
  segmentActive: {
    backgroundColor: colors.background,
  },
  segmentTextActive: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  loading: {
    marginTop: spacing.xl,
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 78,
    overflow: "hidden",
  },
  rail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  jobInfo: {
    flex: 1,
    gap: 2,
    marginLeft: spacing.xs,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontWeight: "700",
    fontSize: 11,
  },
  jobMeta: {
    alignItems: "flex-end",
    gap: 2,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF3EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyIcon: {
    fontSize: 28,
  },
  centered: {
    textAlign: "center",
  },
  emptyButton: {
    marginTop: spacing.sm,
    width: "100%",
  },
});
