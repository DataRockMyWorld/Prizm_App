import { JobRequest, getJob, useAuth } from "@prizm/api";
import { Button, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "WorkerDeclined">;

/** C-declined — terminal screen shown when a worker declines the job after
 * evaluating it on site. The customer can re-request (pre-filled). */
export function WorkerDeclinedScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;
  const [job, setJob] = useState<JobRequest | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getJob(accessToken, jobId)
      .then(setJob)
      .catch(() => {});
  }, [accessToken, jobId]);

  const workerName = (job?.worker?.full_name || "The worker").split(" ")[0];
  const reason = job?.decline_reason;

  const requestAgain = () => {
    navigation.replace("RequestSubmission", {
      categoryId: job?.category.id,
      prefill: job
        ? {
            description: job.description,
            address: job.address,
            latitude: job.latitude,
            longitude: job.longitude,
          }
        : undefined,
    });
  };

  return (
    <Screen>
      <View style={styles.content}>
        <ThemedText variant="display" style={styles.mark}>
          —
        </ThemedText>
        <ThemedText variant="title" style={styles.centered}>
          {workerName} couldn't take this job
        </ThemedText>
        {reason && reason.toLowerCase() !== "other" && (
          <ThemedText variant="body" style={styles.centered}>
            Reason given: {reason.toLowerCase()}.
          </ThemedText>
        )}
        <ThemedText variant="caption" style={styles.centered}>
          It happens — there are other workers nearby who can help today.
        </ThemedText>

        <View style={styles.spacer} />
        <Button label="Request again" onPress={requestAgain} style={styles.button} />
        <Button
          label="Back to home"
          variant="ghost"
          onPress={() => navigation.popToTop()}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
  },
  mark: {
    color: colors.textSecondary,
  },
  centered: {
    textAlign: "center",
  },
  spacer: {
    flex: 1,
  },
  button: {
    width: "100%",
  },
});
