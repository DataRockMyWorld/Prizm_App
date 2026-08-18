import { login, useAuth } from "@prizm/api";
import { Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { PIN_LENGTH, PinEntry } from "../components/PinEntry";
import type { AuthStackParamList } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "LoginPin">;

/** Returning users: phone is already verified via OTP, just need their PIN. */
export function LoginPinScreen({ route }: Props) {
  const { phoneNumber } = route.params;
  const { setSession } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let cancelled = false;
    (async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        const tokens = await login(phoneNumber, pin);
        if (!cancelled) await setSession(tokens);
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
  }, [pin, phoneNumber, setSession]);

  return (
    <Screen>
      <View style={styles.content}>
        <ThemedText variant="title" style={styles.centered}>
          Welcome back
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          Enter your PIN for {phoneNumber}
        </ThemedText>
        <View style={styles.dotsWrap}>
          <PinEntry value={pin} onChangeText={setPin} autoFocus />
        </View>
        {error && (
          <ThemedText style={[styles.error, styles.centered]}>{error}</ThemedText>
        )}
        {isSubmitting && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xs,
    paddingBottom: spacing.xl,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  dotsWrap: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  spinner: {
    marginTop: spacing.md,
  },
});
