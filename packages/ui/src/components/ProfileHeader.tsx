import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../tokens";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { ThemedText } from "./ThemedText";

export interface ProfileHeaderProps {
  photo: string | null;
  fullName: string;
  /** Launches the device photo picker; the caller owns the actual
   * ImagePicker call and the upload request. */
  onPickPhoto: () => void;
  /** Persists the edited name; the caller owns the actual API call.
   * Throwing surfaces an inline error instead of leaving edit mode. */
  onSaveName: (name: string) => Promise<void>;
  isUploadingPhoto?: boolean;
  /** Flips the name/Edit/Cancel text to light colors for use atop a dark
   * or gradient background (e.g. inside ProfileHero's worker variant).
   * The inline TextField keeps its own light input box either way, so it
   * stays legible without any change. */
  inverse?: boolean;
}

/** Avatar + editable name, shared by both apps' Profile screens — the
 * only Profile-screen content that isn't role-specific (worker's screen
 * adds an ID-verification badge below this, customer's doesn't, but this
 * header itself is identical either way). */
export function ProfileHeader({
  photo,
  fullName,
  onPickPhoto,
  onSaveName,
  isUploadingPhoto,
  inverse,
}: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(fullName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setDraft(fullName);
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === fullName) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSaveName(trimmed);
      setIsEditing(false);
    } catch {
      setError("Couldn't save your name. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        <Avatar uri={photo} onPress={onPickPhoto} size={88} />
        {isUploadingPhoto && (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color={colors.textInverse} />
          </View>
        )}
      </View>

      {isEditing ? (
        <View style={styles.editRow}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="words"
            autoFocus
            style={styles.nameField}
          />
          <View style={styles.editActions}>
            <Pressable onPress={() => setIsEditing(false)} hitSlop={8}>
              <ThemedText
                variant="body"
                style={[styles.cancelLink, inverse && styles.cancelLinkInverse]}
              >
                Cancel
              </ThemedText>
            </Pressable>
            <Button label="Save" onPress={handleSave} loading={isSaving} style={styles.saveButton} />
          </View>
          {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        </View>
      ) : (
        <Pressable onPress={startEditing} style={styles.nameRow} hitSlop={8}>
          <ThemedText variant="subtitle" style={inverse && styles.nameInverse}>
            {fullName || "—"}
          </ThemedText>
          <ThemedText variant="caption" style={[styles.editLink, inverse && styles.editLinkInverse]}>
            Edit
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  avatarWrapper: {
    marginBottom: spacing.xs,
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  editLink: {
    color: colors.primary,
    fontWeight: "700",
  },
  nameInverse: {
    color: colors.textInverse,
  },
  editLinkInverse: {
    color: colors.textInverse,
    textDecorationLine: "underline",
  },
  cancelLinkInverse: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  editRow: {
    width: "100%",
    gap: spacing.xs,
  },
  nameField: {},
  editActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  cancelLink: {
    color: colors.textSecondary,
  },
  saveButton: {
    minWidth: 96,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
  },
});
