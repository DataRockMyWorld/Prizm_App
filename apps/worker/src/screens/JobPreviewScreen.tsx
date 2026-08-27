import { Card, Screen, ThemedText, colors, fontFamily, radii, spacing } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { formatPostedAgo } from "../jobPreview/formatPostedAgo";
import type { WorkerRootStackParamList } from "../navigation/types";

/** Read-only detail view for a "Jobs near you" row on Home — matches the
 * hi-fi "Job preview (unverified · read-only)" screen. No accept/decline
 * action here: per CLAUDE.md, matching is sequential single-offer, not
 * browse-and-choose, so this list (and this screen) is informational only
 * regardless of verification status — only the bottom hint copy changes. */
export function JobPreviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params: WorkerRootStackParamList["JobPreview"] = route.params;
  const { categoryName, description, distanceKm, priceMin, priceMax, createdAt, isVerified } =
    params;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">Job details</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.categoryTag}>
        <ThemedText variant="caption" style={styles.categoryTagText}>
          {categoryName.toUpperCase()}
        </ThemedText>
      </View>
      <ThemedText variant="title" style={styles.title}>
        {categoryName}
      </ThemedText>
      {!!description && (
        <ThemedText variant="body" style={styles.description}>
          {description}
        </ThemedText>
      )}

      <Card style={styles.metaCard}>
        <MetaRow
          label="Distance"
          value={distanceKm !== null ? `${distanceKm}km from you` : "Unknown"}
        />
        <MetaRow label="Posted" value={formatPostedAgo(createdAt)} />
      </Card>

      <Card style={styles.rangeCard}>
        <View style={{ flex: 1 }}>
          <ThemedText variant="caption" style={styles.rangeLabel}>
            ESTIMATED RANGE
          </ThemedText>
          <ThemedText variant="caption">Final price agreed after assessment</ThemedText>
        </View>
        <ThemedText variant="title" style={styles.rangeValue}>
          N${priceMin}–{priceMax}
        </ThemedText>
      </Card>

      {!isVerified && (
        <Card style={styles.hintCard}>
          <View style={styles.hintIconCircle}>
            <ThemedText style={styles.hintIcon}>⏳</ThemedText>
          </View>
          <ThemedText variant="body" style={{ flex: 1 }}>
            You'll be able to accept jobs like this once you're verified.
          </ThemedText>
        </Card>
      )}

      <ThemedText variant="caption" style={styles.footerNote}>
        Live requests are sent only to online, verified workers.
      </ThemedText>
    </Screen>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <ThemedText variant="caption">{label}</ThemedText>
      <ThemedText variant="body">{value}</ThemedText>
    </View>
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
  categoryTag: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF3EA",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  categoryTagText: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontSize: 11,
  },
  title: {
    marginTop: spacing.sm,
  },
  description: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  metaCard: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rangeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rangeLabel: {
    fontFamily: fontFamily.bold,
    color: colors.textSecondary,
  },
  rangeValue: {
    color: colors.primary,
  },
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.sm,
  },
  hintIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  hintIcon: {
    fontSize: 15,
  },
  footerNote: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
