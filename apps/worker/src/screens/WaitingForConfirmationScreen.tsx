import { useAuth } from "@prizm/api";
import { colors, spacing, ThemedText } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { useJobStatusPolling } from "../waitingForConfirmation/useJobStatusPolling";

/** W5 — full-screen wait state while the customer confirms or disputes the
 * worker's proposed price. */
export function WaitingForConfirmationScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const jobId: number = route.params.jobId;
  const { job, branch } = useJobStatusPolling({ accessToken, jobId });

  useEffect(() => {
    if (branch === "completed") {
      navigation.replace("JobComplete", { jobId });
    } else if (branch === "disputed") {
      Alert.alert(
        "Pricing flagged",
        "The customer flagged a pricing issue — this has been sent for review.",
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
          Waiting for {firstName} to confirm
        </ThemedText>
        <ThemedText variant="caption" style={styles.centered}>
          You proposed N${job.agreed_price} for this job. We'll notify you once they confirm or
          dispute it.
        </ThemedText>
      </View>
      <View style={styles.summaryChip}>
        <ThemedText variant="caption" style={styles.summaryText}>
          N${job.agreed_price} · {job.category.name}
          {job.description ? ` · ${job.description}` : ""}
        </ThemedText>
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    width: "100%",
  },
  summaryText: {
    textAlign: "center",
  },
});
