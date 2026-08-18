import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "../tokens";

export interface PinDotsProps {
  length: number;
  filled: number;
}

export function PinDots({ length, filled }: PinDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, index) =>
        index < filled ? (
          <LinearGradient
            key={index}
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dot}
          />
        ) : (
          <View key={index} style={[styles.dot, styles.dotEmpty]} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotEmpty: {
    borderWidth: 2,
    borderColor: colors.border,
  },
});
