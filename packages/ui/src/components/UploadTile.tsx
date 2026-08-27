import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../tokens";
import { ThemedText } from "./ThemedText";

export interface UploadTileProps {
  label: string;
  uri?: string | null;
  onPress: () => void;
  /** Shows a small "×" button over a filled preview to clear it back to
   * empty, e.g. if the worker doesn't like the shot. Optional and additive
   * — omit to keep the old behavior (retake only by tapping the tile
   * again, which re-opens the picker). */
  onRemove?: () => void;
}

export function UploadTile({ label, uri, onPress, onRemove }: UploadTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, uri ? styles.tileFilled : styles.tileEmpty]}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
          {onRemove && (
            <Pressable onPress={onRemove} hitSlop={8} style={styles.removeButton}>
              <ThemedText style={styles.removeButtonLabel}>×</ThemedText>
            </Pressable>
          )}
        </>
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
    // A definite height, not just minHeight — the preview Image below
    // uses height: "100%", which needs a resolvable parent height to size
    // against. Without one (the old minHeight-only version), it could
    // resolve against unbounded available space and balloon to fill
    // nearly the whole screen — confirmed live on a physical device
    // (2026-08-26) with a tall crop from the ID-upload camera flow.
    height: 180,
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
  },
  removeButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonLabel: {
    color: colors.textInverse,
    fontSize: 18,
    lineHeight: 20,
  },
});
