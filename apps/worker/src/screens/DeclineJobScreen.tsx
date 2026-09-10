import { ApiError, CancellationReason, declineJob, useAuth } from "@prizm/api";
import { Button, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ReasonPicker } from "../activeJob/ReasonPicker";

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "detail" in error.data) {
    return String((error.data as { detail: unknown }).detail);
  }
  return fallback;
}

/** W2-decline — worker declines the job after evaluating it on site. Closes
 * the job (terminal); the customer is told and can request again. */
export function DeclineJobScreen() {
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
      await declineJob(accessToken, jobId, selected, note.trim());
      navigation.navigate("Tabs");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't decline this job. Please try again."));
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
        <ThemedText variant="subtitle">Decline job</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ThemedText variant="caption" style={styles.prompt}>
        Why are you declining?
      </ThemedText>

      <ReasonPicker selected={selected} onSelect={setSelected} />

      <TextField
        placeholder="Add a note (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        style={styles.noteField}
      />

      <ThemedText variant="caption" style={styles.warning}>
        This closes the job — the customer will be asked to request again.
      </ThemedText>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <View style={styles.spacer} />
      <Button
        label="Decline job"
        variant="danger"
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
    marginBottom: spacing.md,
  },
  prompt: {
    marginBottom: spacing.sm,
  },
  noteField: {
    minHeight: 70,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  warning: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
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
