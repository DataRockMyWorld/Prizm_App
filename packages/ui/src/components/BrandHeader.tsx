import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../tokens";
import { ThemedText } from "./ThemedText";

export interface BrandHeaderProps {
  /** Rendered on the right — a notification dot, avatar, etc. */
  rightAccessory?: React.ReactNode;
}

/** The small "PRISM" logo + wordmark row at the top of home screens. */
export function BrandHeader({ rightAccessory }: BrandHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logo}
        />
        <ThemedText variant="subtitle">PRISM</ThemedText>
      </View>
      {rightAccessory}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
});
