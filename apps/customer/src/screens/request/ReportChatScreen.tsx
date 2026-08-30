import { ReportCategory, reportJob, useAuth } from "@prizm/api";
import { Button, Card, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "ReportChat">;

const REASONS: { label: string; value: ReportCategory }[] = [
  { label: "Harassment or abusive language", value: "harassment" },
  { label: "Inappropriate content", value: "inappropriate_content" },
  { label: "Spam or scam", value: "spam" },
  { label: "Other", value: "other" },
];

/** Chat-safety report — a specific message (messageId + messageText set,
 * long-pressed from ChatScreen) or the other party generally (header
 * overflow menu's "Report user", no message params). Separate screen from
 * the pre-existing ReportProblemScreen, which covers job-outcome disputes
 * with a different category set — see docs/prds/chat-safety.md. */
export function ReportChatScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId, messageId, messageText } = route.params;
  const [selected, setSelected] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selected || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await reportJob(accessToken, jobId, selected, details.trim(), messageId);
      navigation.goBack();
    } catch {
      setError("Couldn't submit your report. Please try again.");
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
        <ThemedText variant="subtitle">{messageText ? "Report message" : "Report user"}</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {messageText && (
        <Card style={styles.messagePreview}>
          <ThemedText variant="caption" style={styles.messagePreviewLabel}>
            Reporting this message
          </ThemedText>
          <ThemedText variant="body">{messageText}</ThemedText>
        </Card>
      )}

      <ThemedText variant="caption" style={styles.prompt}>
        What's the issue?
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
  messagePreview: {
    marginBottom: spacing.md,
  },
  messagePreviewLabel: {
    marginBottom: spacing.xs,
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
