import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../tokens";
import { ThemedText } from "./ThemedText";

export interface UploadTileProps {
  label: string;
  uri?: string | null;
  onPress: () => void;
}

export function UploadTile({ label, uri, onPress }: UploadTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, uri ? styles.tileFilled : styles.tileEmpty]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <>
          <View style={styles.icon} />
          <ThemedText variant="caption">{label}</ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    overflow: "hidden",
  },
  tileEmpty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.xs,
  },
  tileFilled: {
    minHeight: 100,
  },
  icon: {
    width: 34,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.textSecondary,
  },
  preview: {
    width: "100%",
    height: "100%",
    minHeight: 100,
  },
});
