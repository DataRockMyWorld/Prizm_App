import { ApiError, getJob, JobRequest, submitQuote, useAuth } from "@prizm/api";
import { Button, Screen, TextField, ThemedText, colors, fontFamily, spacing } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { validatePriceAmount } from "../activeJob/priceValidation";

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "detail" in error.data) {
    return String((error.data as { detail: unknown }).detail);
  }
  return fallback;
}

/** W2-eval-b — the worker's on-site quote. Sets the price *before* work; the
 * customer confirms it next (WaitingForConfirmation → they get C-quote). */
export function SendQuoteScreen() {
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
      .then((data) => {
        setJob(data);
        // Coming back to re-quote — pre-fill what was sent before.
        if (data.agreed_price) setAmount(String(data.agreed_price));
        if (data.worker_note) setNote(data.worker_note);
      })
      .catch(() => {
        // leave job null — range hint just won't render
      });
  }, [accessToken, jobId]);

  const parsedAmount = validatePriceAmount(amount);

  const handleSubmit = async () => {
    if (parsedAmount === null || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitQuote(accessToken, jobId, parsedAmount, note.trim());
      navigation.replace("WaitingForConfirmation", { jobId });
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send this to the customer. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back">
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">Quote</ThemedText>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.header}>
        <ThemedText variant="title">Your quote</ThemedText>
        <ThemedText variant="caption" style={styles.subtitle}>
          The customer confirms this before you start.
        </ThemedText>
      </View>

      <View style={styles.field}>
        <ThemedText variant="caption" style={styles.fieldLabel}>
          Amount
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
            Typical range: N${job.price_range_min}–{job.price_range_max}
          </ThemedText>
        )}
      </View>

      <View style={styles.field}>
        <ThemedText variant="caption" style={styles.fieldLabel}>
          What's included (optional)
        </ThemedText>
        <TextField
          placeholder="e.g. Kitchen, bathroom and living room, cleaning products included"
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
          label="Send quote"
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  subtitle: {
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
