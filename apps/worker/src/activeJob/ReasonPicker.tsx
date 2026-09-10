import type { CancellationReason } from "@prizm/api";
import { colors, spacing, ThemedText } from "@prizm/ui";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export const CANCELLATION_REASONS: { label: string; value: CancellationReason }[] = [
  { label: "Personal emergency", value: "personal_emergency" },
  { label: "Vehicle or transport issue", value: "transport_issue" },
  { label: "Job details unclear", value: "job_details_unclear" },
  { label: "Other", value: "other" },
];

/** Shared single-select reason list — used by both CancelJob (before
 * arrival) and DeclineJob (on-site evaluate). */
export function ReasonPicker({
  selected,
  onSelect,
}: {
  selected: CancellationReason | null;
  onSelect: (value: CancellationReason) => void;
}) {
  return (
    <View style={styles.list}>
      {CANCELLATION_REASONS.map((reason) => (
        <Pressable
          key={reason.value}
          onPress={() => onSelect(reason.value)}
          style={[styles.item, selected === reason.value && styles.itemActive]}
        >
          <ThemedText variant="body">{reason.label}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  item: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  itemActive: {
    borderColor: colors.primary,
  },
});
