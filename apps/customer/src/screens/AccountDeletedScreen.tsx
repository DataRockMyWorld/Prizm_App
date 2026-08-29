import { useAuth } from "@prizm/api";
import { Button, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet, View } from "react-native";

/** D5 — success screen. `clearSession()` (same effect logout already
 * uses) runs when the user taps through, not automatically on mount —
 * so they see this confirmation before the app drops them back to
 * phone-entry, rather than it flashing past. */
export function AccountDeletedScreen() {
  const { clearSession } = useAuth();

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <ThemedText variant="title" style={styles.checkMark}>
            ✓
          </ThemedText>
        </View>
        <ThemedText variant="title" style={styles.centered}>
          Your account has been deleted
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          Your profile and personal information have been removed from Prism. Anonymized
          financial records are retained for legal and accounting purposes only.
        </ThemedText>
        <Button
          label="Return to sign in"
          variant="dark"
          onPress={clearSession}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  checkCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: colors.textPrimary,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  button: {
    width: "100%",
  },
});
