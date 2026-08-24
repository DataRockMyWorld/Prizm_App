import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../tokens";
import { ThemedText } from "./ThemedText";

export interface SettingsRowProps {
  label: string;
  /** Trailing status text before the chevron, e.g. "•••• 4321" or "Accepted". */
  detail?: string;
  onPress: () => void;
  /** Omits the top divider — pass true for the first row in a group. */
  isFirst?: boolean;
}

/** A tappable "‹label› › " row inside an Account-style settings list.
 * Deliberately more generously padded than the Saved-addresses/
 * Certifications rows elsewhere on the page — those are naturally tall
 * because they carry two lines of text plus an icon; a single-line
 * settings row needs its own top+bottom padding to reach a comparable
 * visual weight, not the same margin/padding-top-only formula. */
export function SettingsRow({ label, detail, onPress, isFirst }: SettingsRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !isFirst && styles.divider]}>
      <ThemedText variant="body">{label}</ThemedText>
      <View style={styles.trailing}>
        {detail ? (
          <ThemedText variant="caption" style={styles.detail}>
            {detail}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.chevron}>›</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detail: {
    color: colors.textSecondary,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 18,
  },
});
