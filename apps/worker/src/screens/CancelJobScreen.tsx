import { ApiError, CancellationReason, cancelJobAsWorker, useAuth } from "@prizm/api";
import { Button, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const REASONS: { label: string; value: CancellationReason }[] = [
  { label: "Personal emergency", value: "personal_emergency" },
  { label: "Vehicle or transport issue", value: "transport_issue" },
  { label: "Job details unclear", value: "job_details_unclear" },
  { label: "Other", value: "other" },
];

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "detail" in error.data) {
    return String((error.data as { detail: unknown }).detail);
  }
  return fallback;
}

/** W3 — free cancellation within the 10-minute window, with a required
 * reason and optional note. */
export function CancelJobScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const jobId: number = route.params.jobId;

  const [selected, setSelected] = useState<CancellationReason | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selected || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await cancelJobAsWorker(accessToken, jobId, selected, note.trim());
      navigation.navigate("Tabs");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't cancel this job. Please try again."));
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
        <ThemedText variant="subtitle">Cancel job</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.warningBanner}>
        <ThemedText style={styles.warningText}>
          You can cancel free of charge within 10 minutes of accepting. This option disappears
          after that — cancelling later goes through Report a Problem.
        </ThemedText>
      </View>

      <ThemedText variant="caption" style={styles.prompt}>
        Why are you cancelling?
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
        placeholder="Add a note (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        style={styles.noteField}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <View style={styles.spacer} />
      <Button
        label="Confirm Cancellation"
        onPress={handleConfirm}
        disabled={!selected}
        loading={isSubmitting}
        style={styles.confirmButton}
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
  warningBanner: {
    backgroundColor: "#FFF3EA",
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  warningText: {
    color: "#9A5A2A",
    fontSize: 11,
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
  noteField: {
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
  confirmButton: {
    marginBottom: spacing.md,
  },
});
