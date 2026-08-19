import { JobRequest, confirmPrice, disputePrice, getJob, useAuth } from "@prizm/api";
import { Button, Card, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "PriceAgreement">;

export function PriceAgreementScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;
  const [job, setJob] = useState<JobRequest | null>(null);
  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeDetails, setDisputeDetails] = useState("");
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
      await confirmPrice(accessToken, jobId);
      navigation.replace("Rating", { jobId });
    } catch {
      setError("Couldn't confirm the price. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispute = async () => {
    if (!accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await disputePrice(accessToken, jobId, disputeDetails.trim());
      navigation.popToTop();
    } catch {
      setError("Couldn't submit your dispute. Please try again.");
    } finally {
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

  return (
    <Screen>
      <View style={styles.content}>
        <ThemedText variant="title" style={styles.centered}>
          Job complete
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          Confirm the price you agreed with {job.worker?.full_name || "your worker"}
        </ThemedText>

        <Card style={styles.priceCard}>
          <ThemedText variant="caption" style={styles.priceLabel}>
            Agreed price
          </ThemedText>
          <ThemedText variant="display">N${job.agreed_price}</ThemedText>
        </Card>

        <ThemedText variant="caption" style={styles.centered}>
          This is the amount you and {job.worker?.full_name || "your worker"} settled on after the
          job — not a fixed platform price
        </ThemedText>

        {isDisputing ? (
          <>
            <TextField
              placeholder="What's wrong with this price? (optional)"
              value={disputeDetails}
              onChangeText={setDisputeDetails}
              multiline
              style={styles.disputeField}
            />
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}
            <Button
              label="Submit Dispute"
              onPress={handleDispute}
              loading={isSubmitting}
              style={styles.button}
            />
          </>
        ) : (
          <>
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}
            <View style={styles.spacer} />
            <Button
              label={`Confirm N$${job.agreed_price}`}
              onPress={handleConfirm}
              loading={isSubmitting}
              style={styles.button}
            />
            <Pressable onPress={() => setIsDisputing(true)}>
              <ThemedText variant="body" style={styles.disputeLink}>
                This isn't right
              </ThemedText>
            </Pressable>
          </>
        )}
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
  centered: {
    textAlign: "center",
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  priceCard: {
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  priceLabel: {
    fontWeight: "700",
  },
  disputeField: {
    minHeight: 70,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
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
  disputeLink: {
    textAlign: "center",
    color: colors.primary,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
});
