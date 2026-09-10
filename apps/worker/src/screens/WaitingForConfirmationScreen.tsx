import { useAuth } from "@prizm/api";
import { Button, colors, fontFamily, radii, spacing, ThemedText } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";

import { useJobStatusPolling } from "../waitingForConfirmation/useJobStatusPolling";

/** W-quote-wait — full-screen wait while the customer confirms (or rejects)
 * the worker's on-site quote. This is *before* the work in the v2 flow. */
export function WaitingForConfirmationScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const jobId: number = route.params.jobId;
  const { job, branch } = useJobStatusPolling({ accessToken, jobId });

  useEffect(() => {
    if (branch === "quote_accepted") {
      navigation.replace("ActiveJob", { jobId });
    } else if (branch === "rejected") {
      Alert.alert(
        "Quote not accepted",
        "The customer didn't accept your quote, so the job has closed.",
        [{ text: "OK", onPress: () => navigation.navigate("Tabs") }]
      );
    } else if (branch === "other") {
      Alert.alert(
        "Job status changed",
        "This job's status changed unexpectedly — check the Jobs tab for details.",
        [{ text: "OK", onPress: () => navigation.navigate("Tabs") }]
      );
    }
  }, [branch, navigation, jobId]);

  if (!job) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const firstName = job.customer?.full_name?.split(" ")[0] || "the customer";

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <View style={styles.textBlock}>
        <ThemedText variant="title" style={styles.centered}>
          Waiting for {firstName} to confirm your quote
        </ThemedText>
        <ThemedText variant="caption" style={styles.centered}>
          We'll let you know as soon as they do. You can start once the quote is confirmed.
        </ThemedText>
      </View>
      <View style={styles.summaryChip}>
        <ThemedText variant="caption" style={styles.summaryLabel}>
          QUOTED
        </ThemedText>
        <ThemedText variant="subtitle">N${job.agreed_price}</ThemedText>
      </View>
      <Button
        label={`Message ${firstName}`}
        variant="secondary"
        onPress={() => navigation.navigate("Chat", { jobId })}
      />

      {/* Escape hatches — the job keeps polling and stays reachable from
          the Jobs tab, so leaving here isn't a dead end. */}
      <View style={styles.linkRow}>
        <Pressable onPress={() => navigation.navigate("Tabs")} hitSlop={8}>
          <ThemedText variant="caption" style={styles.link}>
            Back to Jobs
          </ThemedText>
        </Pressable>
        <ThemedText variant="caption" style={styles.linkDivider}>
          ·
        </ThemedText>
        <Pressable onPress={() => navigation.navigate("DeclineJob", { jobId })} hitSlop={8}>
          <ThemedText variant="caption" style={styles.linkDanger}>
            Decline this job
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  textBlock: {
    gap: spacing.xs,
  },
  centered: {
    textAlign: "center",
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    width: "100%",
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  link: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bold,
  },
  linkDivider: {
    color: colors.textSecondary,
  },
  linkDanger: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
  },
});
