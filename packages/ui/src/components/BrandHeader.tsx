import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { prismLogo } from "../assets";
import { spacing } from "../tokens";
import { ThemedText } from "./ThemedText";

export interface BrandHeaderProps {
  /** Rendered on the right — a notification dot, avatar, etc. */
  rightAccessory?: React.ReactNode;
}

/** The small Prism logo + wordmark row at the top of home screens. */
export function BrandHeader({ rightAccessory }: BrandHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Image source={prismLogo} style={styles.logo} resizeMode="contain" />
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
  },
});
