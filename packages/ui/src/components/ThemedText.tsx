import React from "react";
import { Text, TextProps, TextStyle } from "react-native";

import { colors, fontFamily, fontSize, lineHeight } from "../tokens";

export type ThemedTextVariant =
  | "display"
  | "title"
  | "subtitle"
  | "body"
  | "caption";

const VARIANT_STYLE: Record<ThemedTextVariant, TextStyle> = {
  display: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize.display,
    lineHeight: lineHeight.display,
    color: colors.textPrimary,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: colors.textSecondary,
  },
};

export interface ThemedTextProps extends TextProps {
  variant?: ThemedTextVariant;
}

export function ThemedText({ variant = "body", style, ...rest }: ThemedTextProps) {
  return <Text style={[VARIANT_STYLE[variant], style]} {...rest} />;
}
