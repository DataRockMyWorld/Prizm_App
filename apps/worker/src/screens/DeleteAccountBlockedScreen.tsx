import { Button, Card, fontFamily, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { getJobsTabRoute } from "../jobsTab/jobsTabRouting";
import type { WorkerRootStackParamList } from "../navigation/types";

type RouteParams = WorkerRootStackParamList["DeleteAccountBlocked"];

/** D2 — shown instead of the warning screen when the Profile row's
 * pre-check (or, on a race, the final confirm step) finds an active job.
 * "Job in progress" framing is worker-specific — see PRD §5d for why the
 * customer path's "unpaid job" wording is cosmetic only, not a different
 * guard-rail check. */
export function DeleteAccountBlockedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { job }: RouteParams = route.params;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
      </View>

      <View style={styles.badge}>
        <ThemedText variant="caption" style={styles.badgeText}>
          DELETION UNAVAILABLE
        </ThemedText>
      </View>

      <ThemedText variant="title" style={styles.title}>
        You have a job in progress
      </ThemedText>
      <ThemedText variant="body" style={styles.subtitle}>
        We cannot delete your account while a job is open — the customer is relying on it and
        payment has not settled. Finish or cancel the job, then try again.
      </ThemedText>

      <ThemedText variant="caption" style={styles.sectionLabel}>
        RESOLVE THIS FIRST
      </ThemedText>
      <Pressable
        onPress={() => navigation.navigate(getJobsTabRoute(job.status), { jobId: job.id })}
      >
        <Card style={styles.jobCard}>
          <View style={styles.jobIcon}>
            <ThemedText style={styles.jobIconText}>🧾</ThemedText>
          </View>
          <View style={styles.jobInfo}>
            <ThemedText variant="subtitle" numberOfLines={1}>
              {job.category.name}
              {job.description ? ` — ${job.description}` : ""}
            </ThemedText>
            <ThemedText variant="caption" numberOfLines={1}>
              {job.customer?.full_name || "Customer"} · {job.status.replace(/_/g, " ")}
            </ThemedText>
          </View>
          <ThemedText variant="title" style={styles.chevron}>
            ›
          </ThemedText>
        </Card>
      </Pressable>

      <Card style={styles.infoCard}>
        <ThemedText variant="caption">
          Once it is resolved, return to <ThemedText variant="caption" style={styles.bold}>Profile › Delete account</ThemedText> and
          the request will go through. Nothing has been deleted.
        </ThemedText>
      </Card>

      <View style={styles.spacer} />
      <Button
        label="Go to the job"
        variant="dark"
        onPress={() => navigation.navigate(getJobsTabRoute(job.status), { jobId: job.id })}
      />
      <Pressable
        onPress={() => navigation.navigate("Tabs", { screen: "Profile" })}
        style={styles.backLink}
        hitSlop={8}
      >
        <ThemedText variant="body" style={styles.centered}>
          Back to profile
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#FDF3E3",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  badgeText: {
    color: "#8A5A12",
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
    fontSize: 10.5,
  },
  title: {
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  jobIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FFF2EA",
    alignItems: "center",
    justifyContent: "center",
  },
  jobIconText: {
    fontSize: 15,
  },
  jobInfo: {
    flex: 1,
    gap: 2,
  },
  chevron: {
    color: colors.textSecondary,
  },
  infoCard: {
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.md,
  },
  bold: {
    fontFamily: fontFamily.bold,
    color: colors.textPrimary,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
  backLink: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  centered: {
    textAlign: "center",
  },
});
