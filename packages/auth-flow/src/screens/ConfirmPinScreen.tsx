import { register, useAuth } from "@prizm/api";
import { Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { PIN_LENGTH, PinEntry } from "../components/PinEntry";
import type { AuthStackParamList, Role } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "ConfirmPin"> & { role: Role };

export function ConfirmPinScreen({ route, role }: Props) {
  const { otpToken, pin } = route.params;
  const { setSession } = useAuth();
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (confirmPin.length !== PIN_LENGTH) return;

    if (confirmPin !== pin) {
      setError("PINs don't match — try again");
      setConfirmPin("");
      return;
    }

    let cancelled = false;
    (async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        const tokens = await register(otpToken, role, pin);
        if (!cancelled) await setSession(tokens);
      } catch {
        if (!cancelled) {
          setError("Something went wrong creating your account. Please try again.");
          setConfirmPin("");
        }
      } finally {
        if (!cancelled) setIsSubmitting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmPin, pin, otpToken, role, setSession]);

  return (
    <Screen>
      <View style={styles.content}>
        <ThemedText variant="caption" style={styles.step}>
          STEP 2 OF 2
        </ThemedText>
        <ThemedText variant="title">Confirm your PIN</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          Re-enter your PIN to confirm
        </ThemedText>
        <View style={styles.dotsWrap}>
          <PinEntry value={confirmPin} onChangeText={setConfirmPin} autoFocus />
        </View>
        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        {isSubmitting && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.xl,
    gap: spacing.xs,
  },
  step: {
    color: "#FF6C22",
    fontFamily: "Manrope_800ExtraBold",
    letterSpacing: 0.5,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  dotsWrap: {
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: "center",
  },
  spinner: {
    marginTop: spacing.md,
  },
});
