import { PIN_LENGTH, PinEntry } from "@prizm/auth-flow";
import { login, useAuth } from "@prizm/api";
import { Screen, ThemedText, colors, fontFamily, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

/** D3 — "confirm it's really you" before continuing to the final,
 * irreversible step. Reuses the login endpoint rather than a new
 * "verify PIN" one: a fresh, unused token pair on success (discarded —
 * the existing session's tokens are untouched) or a 401/429 on a wrong/
 * locked-out PIN, which already inherits PinLoginThrottle's lockout
 * protection for free. See docs/prds/app-store-readiness.md §6. */
export function DeleteAccountPinScreen() {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !profile) return;
    let cancelled = false;
    (async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await login(profile.phone_number, pin);
        if (!cancelled) navigation.navigate("DeleteAccountConfirm");
      } catch {
        if (!cancelled) {
          setError("Incorrect PIN — try again.");
          setPin("");
        }
      } finally {
        if (!cancelled) setIsSubmitting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pin, profile, navigation]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
      </View>

      <ThemedText variant="caption" style={styles.step}>
        STEP 1 OF 2
      </ThemedText>

      <View style={styles.content}>
        <ThemedText variant="title">Enter your PIN</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          Confirm it is really you before we continue with deletion.
        </ThemedText>
        <View style={styles.dotsWrap}>
          <PinEntry value={pin} onChangeText={setPin} autoFocus />
        </View>
        {error && <ThemedText style={[styles.error, styles.centered]}>{error}</ThemedText>}
        {isSubmitting && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
  },
  step: {
    color: colors.danger,
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xs,
    paddingBottom: spacing.xl,
  },
  subtitle: {
    color: colors.textSecondary,
  },
  dotsWrap: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  spinner: {
    marginTop: spacing.md,
  },
  centered: {
    textAlign: "center",
  },
});
