import React from "react";
import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from "react-native";

import { colors, fontFamily, fontSize, radii, spacing } from "../tokens";

export interface TextFieldProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  /** Rendered before the input, e.g. a "+264" country code. */
  prefix?: React.ReactNode;
}

export function TextField({ containerStyle, prefix, style, ...rest }: TextFieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {prefix}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 52,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
});
