import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { colors } from "../tokens";

export interface AvatarProps {
  uri?: string | null;
  size?: number;
  onPress?: () => void;
  /** Shows the small brand-gradient "edit" badge when `onPress` is set.
   * Defaults to true (existing behavior). The customer Profile hero turns
   * this off to match the approved hi-fi's plain circular photo — tapping
   * the photo itself still opens the picker either way, this only hides
   * the extra dot. */
  showEditBadge?: boolean;
}

/** Circular profile photo with an optional small brand-gradient "edit" badge. */
export function Avatar({ uri, size = 96, onPress, showEditBadge = true }: AvatarProps) {
  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.circle, { width: size, height: size }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.circle, styles.placeholder, { width: size, height: size }]} />
      )}
      {onPress && showEditBadge && (
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
