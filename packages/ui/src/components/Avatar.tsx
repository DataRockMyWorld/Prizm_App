import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { colors } from "../tokens";

export interface AvatarProps {
  uri?: string | null;
  size?: number;
  onPress?: () => void;
}

/** Circular profile photo with a small brand-gradient "edit" badge. */
export function Avatar({ uri, size = 96, onPress }: AvatarProps) {
  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      {uri ? (
        <Image source={{ uri }} style={[styles.circle, { width: size, height: size }]} />
      ) : (
        <View style={[styles.circle, styles.placeholder, { width: size, height: size }]} />
      )}
      {onPress && (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badge}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
  },
  circle: {
    borderRadius: 999,
  },
  placeholder: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.background,
  },
});
