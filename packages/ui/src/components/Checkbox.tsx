import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../tokens";

export interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function Checkbox({ checked, onToggle, children }: CheckboxProps) {
  return (
    <Pressable style={styles.row} onPress={onToggle} hitSlop={8}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <View style={styles.checkMark} />}
      </View>
      <View style={styles.content}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: colors.primary,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: colors.primary,
  },
  checkMark: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.textInverse,
    transform: [{ rotate: "-45deg" }, { translateY: -1 }],
  },
  content: {
    flex: 1,
  },
});
