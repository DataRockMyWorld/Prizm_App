import { JobRequest, listActiveJobs, listCompletedJobsPage, useAuth } from "@prizm/api";
import { Avatar, Button, Card, colors, fontFamily, radii, Screen, spacing, ThemedText } from "@prizm/ui";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, View } from "react-native";

import { formatJobStatusLabel, getStatusTone, StatusTone } from "../jobsTab/formatJobStatus";
import { formatJobCardDate, groupByRecency } from "../jobsTab/jobsTabGrouping";
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

const PAGE_SIZE = 20;

/** Job history — refetches whenever the tab regains focus, since a job's
 * status can change elsewhere (worker accepts, progresses, completes)
 * while this tab isn't visible. Tapping a still-open job routes into the
 * real live tracking screen rather than a static summary — see
 * getJobsTabRoute.
 *
 * Active and Completed are fetched separately now (see
 * listActiveJobs/listCompletedJobsPage): active jobs are always a small
 * working set so they're still one plain unpaginated call, but a
 * customer's completed history has no natural ceiling — it grows for as
 * long as they use the app — so Completed loads a page at a time via
 * infinite scroll instead of pulling the whole history on every visit. */
export function JobsScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>("active");

  const [activeJobs, setActiveJobs] = useState<JobRequest[] | null>(null);

  const [completedJobs, setCompletedJobs] = useState<JobRequest[]>([]);
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const nextPageRef = useRef(1);

  const loadActive = useCallback(async () => {
    if (!accessToken) return;
    try {
      setActiveJobs(sortJobsNewestFirst(await listActiveJobs(accessToken)));
    } catch {
      setActiveJobs([]);
    }
  }, [accessToken]);

  const loadFirstCompletedPage = useCallback(async () => {
    if (!accessToken) return;
    try {
      const page = await listCompletedJobsPage(accessToken, 1, PAGE_SIZE);
      setCompletedJobs(page.results);
      setHasMore(page.next !== null);
      nextPageRef.current = 2;
    } catch {
      setCompletedJobs([]);
      setHasMore(false);
    } finally {
      setCompletedLoaded(true);
    }
  }, [accessToken]);

  const loadMoreCompleted = useCallback(async () => {
    if (!accessToken || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await listCompletedJobsPage(accessToken, nextPageRef.current, PAGE_SIZE);
      setCompletedJobs((current) => [...current, ...page.results]);
      setHasMore(page.next !== null);
      nextPageRef.current += 1;
    } catch {
      // leave hasMore as-is — a transient failure shouldn't permanently stop pagination;
      // the next scroll-triggered attempt will just retry the same page.
    } finally {
      setIsLoadingMore(false);
    }
  }, [accessToken, hasMore, isLoadingMore]);

  useFocusEffect(
    useCallback(() => {
      loadActive();
      setCompletedLoaded(false);
      setHasMore(true);
      nextPageRef.current = 1;
      loadFirstCompletedPage();
    }, [loadActive, loadFirstCompletedPage])
  );

  const handlePress = (job: JobRequest) => {
    navigation.navigate(getJobsTabRoute(job.status), { jobId: job.id });
  };

  const { thisWeek, earlier } = groupByRecency(completedJobs);
  const sections = [
    ...(thisWeek.length > 0 ? [{ title: "THIS WEEK", data: thisWeek }] : []),
    ...(earlier.length > 0 ? [{ title: "EARLIER", data: earlier }] : []),
  ];

  return (
    <Screen>
      <View style={styles.headerRow}>
        <ThemedText variant="title">Jobs</ThemedText>
        {tab === "active" && activeJobs !== null && (
          <ThemedText variant="caption">{`${activeJobs.length} active`}</ThemedText>
        )}
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

      {tab === "active" ? (
        activeJobs === null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : activeJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <ThemedText style={styles.emptyIcon}>🧰</ThemedText>
            </View>
            <ThemedText variant="subtitle" style={styles.centered}>
              No active jobs
            </ThemedText>
            <ThemedText variant="caption" style={styles.centered}>
              Once you submit a request, you can track it here from the moment we start looking
              for a worker through to the job finishing.
            </ThemedText>
            <Button
              label="Request a service"
              variant="secondary"
              onPress={() => navigation.navigate("Tabs", { screen: "Home" })}
              style={styles.emptyButton}
            />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {activeJobs.map((job) => (
              <JobCard key={job.id} job={job} onPress={handlePress} />
            ))}
          </ScrollView>
        )
      ) : !completedLoaded ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : completedJobs.length === 0 ? (
        <Card>
          <ThemedText variant="subtitle">No completed jobs yet</ThemedText>
          <ThemedText variant="caption">Jobs you complete will show up here.</ThemedText>
        </Card>
      ) : (
        <SectionList
          style={styles.list}
          showsVerticalScrollIndicator={false}
          sections={sections}
          keyExtractor={(job) => String(job.id)}
          renderItem={({ item }) => <JobCard job={item} onPress={handlePress} />}
          renderSectionHeader={({ section }) => (
            <ThemedText variant="caption" style={styles.sectionLabel}>
              {section.title}
            </ThemedText>
          )}
          onEndReachedThreshold={0.4}
          onEndReached={loadMoreCompleted}
          ListFooterComponent={
            isLoadingMore ? <ActivityIndicator color={colors.primary} style={styles.loadingMore} /> : null
          }
        />
      )}
    </Screen>
  );
}

function JobCard({ job, onPress }: { job: JobRequest; onPress: (job: JobRequest) => void }) {
  const toneColor = TONE_COLORS[getStatusTone(job.status)];

  return (
    <Pressable onPress={() => onPress(job)}>
      <Card style={styles.jobCard}>
        <View style={[styles.rail, { backgroundColor: toneColor }]} />
        {job.worker ? (
          <Avatar uri={job.worker.photo} size={38} />
        ) : (
          <View style={styles.workerPlaceholder}>
            <ThemedText style={styles.workerPlaceholderIcon}>🔍</ThemedText>
          </View>
        )}
        <View style={styles.jobInfo}>
          <ThemedText variant="subtitle" numberOfLines={1}>
            {job.worker?.full_name || "Finding a worker…"}
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
    fontFamily: fontFamily.bold,
  },
  loading: {
    marginTop: spacing.xl,
  },
  loadingMore: {
    marginVertical: spacing.md,
  },
  list: {
    flex: 1,
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.textSecondary,
    fontFamily: fontFamily.bold,
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
  workerPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  workerPlaceholderIcon: {
    fontSize: 16,
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
    fontFamily: fontFamily.bold,
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
