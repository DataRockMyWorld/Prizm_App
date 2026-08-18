import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, fontFamily, fontSize, radii, spacing } from "../tokens";
import { ThemedText } from "./ThemedText";

export type BadgeTone = "verified" | "certified" | "neutral";

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const TONE_COLORS: Record<BadgeTone, { background: string; text: string }> = {
  verified: { background: "#E7F6EC", text: colors.success },
  certified: { background: "#FFF3E3", text: colors.gold },
  neutral: { background: colors.surfaceMuted, text: colors.textSecondary },
};

/** "Verified" (ID approved) / "Certified — [category]" badges from CLAUDE.md. */
export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const toneColors = TONE_COLORS[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneColors.background }]}>
      <ThemedText style={[styles.label, { color: toneColors.text }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
  },
});
