import { ApiError, completeJob, getJob, JobRequest, useAuth } from "@prizm/api";
import { Button, Screen, TextField, ThemedText, colors, fontFamily, spacing } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { validatePriceAmount } from "../activeJob/priceValidation";

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "detail" in error.data) {
    return String((error.data as { detail: unknown }).detail);
  }
  return fallback;
}

/** W4 — worker marks the job complete and proposes a final price. */
export function ProposePriceScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const jobId: number = route.params.jobId;

  const [job, setJob] = useState<JobRequest | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getJob(accessToken, jobId)
      .then(setJob)
      .catch(() => {
        // leave job null — helper range text just won't render
      });
  }, [accessToken, jobId]);

  const parsedAmount = validatePriceAmount(amount);

  const handleSubmit = async () => {
    if (parsedAmount === null || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await completeJob(accessToken, jobId, parsedAmount, note.trim());
      navigation.replace("WaitingForConfirmation", { jobId });
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send this to the customer. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText variant="title" style={styles.title}>
          Job done — propose a price
        </ThemedText>
        <ThemedText variant="caption" style={styles.subtitle}>
          The customer will be asked to confirm this amount
        </ThemedText>
      </View>

      <View style={styles.field}>
        <ThemedText variant="caption" style={styles.fieldLabel}>
          Amount requested
        </ThemedText>
        <TextField
          prefix={<ThemedText style={styles.prefix}>N$</ThemedText>}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          style={styles.amountInput}
        />
        {job && (
          <ThemedText variant="caption" style={styles.rangeHint}>
            Typical range for this job: N${job.price_range_min}–{job.price_range_max}
          </ThemedText>
        )}
      </View>

      <View style={styles.field}>
        <ThemedText variant="caption" style={styles.fieldLabel}>
          What was done (optional)
        </ThemedText>
        <TextField
          placeholder="e.g. Deep cleaned kitchen, bathroom, and living room"
          value={note}
          onChangeText={setNote}
          multiline
          style={styles.noteField}
        />
      </View>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <View style={styles.spacer} />
      {!accessToken ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Button
          label="Send to Customer"
          onPress={handleSubmit}
          disabled={parsedAmount === null}
          loading={isSubmitting}
          style={styles.submitButton}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginTop: spacing.xs,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    marginBottom: spacing.xs,
  },
  prefix: {
    fontFamily: fontFamily.extraBold,
    fontSize: 20,
    color: colors.textSecondary,
  },
  amountInput: {
    fontFamily: fontFamily.extraBold,
    fontSize: 20,
  },
  rangeHint: {
    marginTop: spacing.xs,
  },
  noteField: {
    minHeight: 70,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  spacer: {
    flex: 1,
  },
  submitButton: {
    marginBottom: spacing.md,
  },
});
