import { ReportCategory, disputePrice, reportJob, useAuth } from "@prizm/api";
import { Button, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "ReportProblem">;

const REASONS: { label: string; value: ReportCategory }[] = [
  { label: "Worker didn't show up", value: "no_show" },
  { label: "Safety concern", value: "safety_concern" },
  { label: "Quality of work", value: "quality_of_work" },
  { label: "Pricing disagreement", value: "pricing_disagreement" },
];

export function ReportProblemScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;
  const [selected, setSelected] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selected || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (selected === "pricing_disagreement") {
        // Pricing disputes flip the job to `disputed` for admin review —
        // only valid once the job is completed (the price is agreed
        // up-front now, so a mid-job pricing dispute isn't a thing).
        await disputePrice(accessToken, jobId, details.trim());
        navigation.popToTop();
      } else {
        await reportJob(accessToken, jobId, selected, details.trim());
        navigation.goBack();
      }
    } catch {
      setError(
        selected === "pricing_disagreement"
          ? "You can only dispute the price once the job is complete."
          : "Couldn't submit your report. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">Report a problem</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ThemedText variant="caption" style={styles.prompt}>
        What went wrong with this job?
      </ThemedText>

      <View style={styles.reasonList}>
        {REASONS.map((reason) => (
          <Pressable
            key={reason.value}
            onPress={() => setSelected(reason.value)}
            style={[styles.reasonItem, selected === reason.value && styles.reasonItemActive]}
          >
            <ThemedText variant="body">{reason.label}</ThemedText>
          </Pressable>
        ))}
      </View>

      <TextField
        placeholder="Add details (optional)"
        value={details}
        onChangeText={setDetails}
        multiline
        style={styles.detailsField}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <View style={styles.spacer} />
      <Button
        label="Submit Report"
        onPress={handleSubmit}
        disabled={!selected}
        loading={isSubmitting}
        style={styles.submitButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  prompt: {
    marginBottom: spacing.sm,
  },
  reasonList: {
    gap: spacing.xs,
  },
  reasonItem: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  reasonItemActive: {
    borderColor: colors.primary,
  },
  detailsField: {
    minHeight: 70,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
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
