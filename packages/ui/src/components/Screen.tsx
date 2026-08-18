import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

import { colors, spacing } from "../tokens";

export interface ScreenProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

/** Consistent safe-area + horizontal padding wrapper for top-level screens. */
export function Screen({ children, style, edges = ["top", "bottom"] }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
