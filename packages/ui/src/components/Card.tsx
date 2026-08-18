import React from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";

import { colors, radii, spacing } from "../tokens";

export interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
}

/** Prizm's rounded-card look, used throughout both apps. */
export function Card({ style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
