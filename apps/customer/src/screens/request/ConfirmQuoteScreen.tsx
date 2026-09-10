import { JobRequest, confirmQuote, getJob, rejectQuote, useAuth } from "@prizm/api";
import { Avatar, Button, Card, Screen, ThemedText, colors, fontFamily, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "ConfirmQuote">;

/** C-quote — the customer reviews the worker's on-site quote *before* the
 * work starts. Confirm unlocks "Start work" for the worker; Reject closes
 * the job. (Post-completion pricing disputes go through Report a problem,
 * not here.) */
export function ConfirmQuoteScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;
  const [job, setJob] = useState<JobRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getJob(accessToken, jobId)
      .then(setJob)
      .catch(() => {});
  }, [accessToken, jobId]);

  const handleConfirm = async () => {
    if (!accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await confirmQuote(accessToken, jobId);
      navigation.replace("JobStatus", { jobId });
    } catch {
      setError("Couldn't confirm the quote. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReject = () => {
    Alert.alert(
      "Reject this quote?",
      "This closes the job — you can request a service again afterwards.",
      [
        { text: "Keep reviewing", style: "cancel" },
        { text: "Reject", style: "destructive", onPress: handleReject },
      ]
    );
  };

  const handleReject = async () => {
    if (!accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await rejectQuote(accessToken, jobId);
      navigation.popToTop();
    } catch {
      setError("Couldn't reject the quote. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!job) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </Screen>
    );
  }

  const workerName = job.worker?.full_name || "your worker";

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <ThemedText variant="title">‹</ThemedText>
          </Pressable>
          <ThemedText variant="subtitle">{workerName.split(" ")[0]}'s quote</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <Card style={styles.workerCard}>
          <Avatar uri={job.worker?.photo} size={40} />
          <View style={styles.workerInfo}>
            <ThemedText variant="subtitle" numberOfLines={1}>
              {job.worker?.full_name || "Your worker"}
            </ThemedText>
            <ThemedText variant="caption">{job.category.name}</ThemedText>
          </View>
        </Card>

        <Card style={styles.priceCard}>
          <ThemedText variant="caption" style={styles.priceLabel}>
            Quoted price
          </ThemedText>
          <ThemedText variant="display">N${job.agreed_price}</ThemedText>
          <ThemedText variant="caption">
            Estimated range was N${job.price_range_min}–{job.price_range_max}
          </ThemedText>
        </Card>

        {job.worker_note ? (
          <Card style={styles.noteCard}>
            <ThemedText variant="caption" style={styles.priceLabel}>
              What's included
            </ThemedText>
            <ThemedText variant="body">{job.worker_note}</ThemedText>
          </Card>
        ) : null}

        <ThemedText variant="caption" style={styles.reassurance}>
          {workerName.split(" ")[0]} starts once you confirm. Nothing is charged until the job is
          complete.
        </ThemedText>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        <View style={styles.spacer} />

        <Button
          label={`Confirm N$${job.agreed_price}`}
          onPress={handleConfirm}
          loading={isSubmitting}
          style={styles.button}
        />
        <Button label="Reject" variant="ghost" onPress={confirmReject} disabled={isSubmitting} />
        <ThemedText variant="caption" style={styles.rejectHint}>
          Rejecting closes this job — you can request again.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.xl,
  },
  content: {
    flex: 1,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  workerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  workerInfo: {
    flex: 1,
  },
  priceCard: {
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  priceLabel: {
    fontFamily: fontFamily.bold,
  },
  noteCard: {
    gap: spacing.xs,
  },
  reassurance: {
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    textAlign: "center",
  },
  spacer: {
    flex: 1,
  },
  button: {
    marginBottom: spacing.sm,
  },
  rejectHint: {
    textAlign: "center",
    marginBottom: spacing.md,
  },
});
