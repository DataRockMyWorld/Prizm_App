import { getJob, JobRequest, useAuth } from "@prizm/api";
import { Button, colors, spacing, ThemedText } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

/** W-done — plain completion confirmation. The price was agreed at the
 * quote step, so there's nothing to enter here; no earnings ledger since
 * mobile money (step 10) is still stubbed. */
export function JobCompleteScreen() {
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
        // leave job null — the essentials still render without it
      });
  }, [accessToken, jobId]);

  return (
    <View style={styles.container}>
      <ThemedText variant="title" style={styles.centered}>
        Job complete
      </ThemedText>
      {job ? (
        <View style={styles.details}>
          <ThemedText variant="display" style={styles.centered}>
            N${job.agreed_price}
          </ThemedText>
          <ThemedText variant="caption" style={styles.centered}>
            {job.customer?.full_name || "The customer"} pays via Mobile Money
          </ThemedText>
        </View>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
      <Button
        label="Back to Jobs"
        onPress={() => navigation.navigate("Tabs")}
        style={styles.doneButton}
      />
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
    gap: spacing.xl,
  },
  centered: {
    textAlign: "center",
  },
  details: {
    gap: spacing.xs,
  },
  doneButton: {
    width: "100%",
  },
});
