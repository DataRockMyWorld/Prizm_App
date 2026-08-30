import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { colors, fontFamily, fontSize, radii, spacing } from "../tokens";
import { GradientBackground } from "./GradientBackground";
import { ThemedText } from "./ThemedText";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isDarkBackground = variant === "primary" || variant === "danger" || variant === "dark";
  const content = loading ? (
    <ActivityIndicator color={isDarkBackground ? colors.textInverse : colors.primary} />
  ) : (
    <ThemedText
      variant="subtitle"
      style={[
        styles.label,
        variant === "primary" && styles.labelOnPrimary,
        variant === "secondary" && styles.labelSecondary,
        variant === "ghost" && styles.labelGhost,
        variant === "danger" && styles.labelOnDanger,
        variant === "dark" && styles.labelOnDark,
      ]}
    >
      {label}
    </ThemedText>
  );

  if (variant === "primary") {
    // The warm shadow/glow has to live on a wrapper OUTSIDE the
    // gradient's own Pressable, not on that Pressable itself — that inner
    // one needs overflow:"hidden" to clip the gradient to the pill's
    // rounded corners, and overflow:"hidden" silently clips away any
    // shadow applied to the same view. `disabled` is applied here too
    // (not just on the inner Pressable) so the glow dims along with the
    // gradient instead of staying at full strength under a greyed-out
    // button.
    return (
      <View style={[styles.shadowWrapper, isDisabled && styles.disabled, style]}>
        <Pressable
          onPress={onPress}
          disabled={isDisabled}
          style={({ pressed }) => [styles.pressableWrapper, pressed && styles.pressed]}
        >
          <GradientBackground style={styles.base}>{content}</GradientBackground>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        variant === "dark" && styles.dark,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Warm-tinted glow beneath the primary CTA (approved hi-fi) —
  // shadowColor uses the brand orange, not black, for a "glow" rather
  // than a generic drop shadow. Android's `elevation` can't be tinted
  // the same way pre-API-28, so Android gets a plain grey shadow at this
  // elevation — an accepted platform gap, not something worth a bespoke
  // colored-shadow workaround for.
  shadowWrapper: {
    borderRadius: radii.pill,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pressableWrapper: {
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  base: {
    minHeight: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: colors.danger,
  },
  dark: {
    backgroundColor: colors.textPrimary,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
  },
  labelOnPrimary: {
    color: colors.textInverse,
  },
  labelSecondary: {
    color: colors.primary,
  },
  labelGhost: {
    color: colors.textPrimary,
  },
  labelOnDanger: {
    color: colors.textInverse,
  },
  labelOnDark: {
    color: colors.textInverse,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
