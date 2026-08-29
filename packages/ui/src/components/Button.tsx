import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
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
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.pressableWrapper,
          isDisabled && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        <GradientBackground style={styles.base}>{content}</GradientBackground>
      </Pressable>
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
