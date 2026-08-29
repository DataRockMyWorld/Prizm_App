import { deleteAccount, getDeleteAccountErrorMessage, listMyJobs, useAuth } from "@prizm/api";
import { Button, Card, fontFamily, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { isActiveJobStatus } from "../jobsTab/jobsTabGrouping";
import { formatMemberSince } from "../profile/formatMemberSince";

/** D4 — the actual destructive step. On the guard rail's 400 (a job went
 * active *during* this flow — a real if narrow race, since the Profile
 * row's pre-check already ran before this point), re-fetches the job list
 * to find what's now blocking and routes to DeleteAccountBlockedScreen
 * instead of a bare inline error, so the experience is consistent
 * regardless of when the block is discovered. */
export function DeleteAccountConfirmScreen() {
  const navigation = useNavigation<any>();
  const { accessToken, profile, clearSession } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!accessToken) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAccount(accessToken);
      navigation.navigate("AccountDeleted");
    } catch (err) {
      const blockingJob = await listMyJobs(accessToken)
        .then((jobs) => jobs.find((job) => isActiveJobStatus(job.status)))
        .catch(() => undefined);
      if (blockingJob) {
        navigation.replace("DeleteAccountBlocked", { job: blockingJob });
        return;
      }
      setError(getDeleteAccountErrorMessage(err));
      setIsDeleting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
      </View>

      <ThemedText variant="caption" style={styles.step}>
        STEP 2 OF 2
      </ThemedText>

      <ThemedText variant="title" style={styles.title}>
        This cannot be undone
      </ThemedText>
      <ThemedText variant="body" style={styles.subtitle}>
        Deleting removes your profile and personal information from Prism immediately. There is
        no recovery, no grace period and no way to restore your history or ratings.
      </ThemedText>

      <ThemedText variant="caption" style={styles.sectionLabel}>
        DELETING NOW
      </ThemedText>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <ThemedText variant="caption">Account</ThemedText>
          <ThemedText variant="body" style={styles.summaryValue}>
            {profile?.full_name || "—"} · {profile?.phone_number}
          </ThemedText>
        </View>
        <View style={styles.summaryRow}>
          <ThemedText variant="caption">Joined</ThemedText>
          <ThemedText variant="body" style={styles.summaryValue}>
            {formatMemberSince(profile?.date_joined)}
          </ThemedText>
        </View>
      </Card>

      <ThemedText variant="caption" style={styles.footnote}>
        Anonymized financial records are retained for legal and accounting purposes only, as
        described earlier.
      </ThemedText>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <View style={styles.spacer} />
      <Button
        label="Delete my account"
        variant="danger"
        onPress={handleConfirm}
        loading={isDeleting}
      />
      <Pressable onPress={() => navigation.navigate("Tabs", { screen: "Profile" })} style={styles.cancel} hitSlop={8}>
        <ThemedText variant="body" style={styles.centered}>
          Cancel
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
  },
  step: {
    color: colors.danger,
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  title: {
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
    color: colors.danger,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  summaryCard: {
    gap: spacing.xs,
    borderColor: "#F0D9D6",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryValue: {
    fontFamily: fontFamily.bold,
  },
  footnote: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
  cancel: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  centered: {
    textAlign: "center",
  },
});
