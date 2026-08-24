import { verifyOtp, requestOtp } from "@prizm/api";
import { OtpInput, Screen, ThemedText, colors, fontFamily, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import type { AuthStackParamList } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "Otp">;

const RESEND_SECONDS = 30;

export function OtpScreen({ navigation, route }: Props) {
  const { phoneNumber } = route.params;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (code.length !== 6) return;
    let cancelled = false;
    (async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { otp_token, is_new_user } = await verifyOtp(phoneNumber, code);
        if (cancelled) return;
        if (is_new_user) {
          navigation.navigate("CreatePin", { phoneNumber, otpToken: otp_token });
        } else {
          navigation.navigate("LoginPin", { phoneNumber });
        }
      } catch {
        if (cancelled) return;
        setError("That code didn't work — try again.");
        setCode("");
      } finally {
        if (!cancelled) setIsSubmitting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, navigation, phoneNumber]);

  const handleResend = async () => {
    setSecondsLeft(RESEND_SECONDS);
    setError(null);
    try {
      await requestOtp(phoneNumber);
    } catch {
      setError("Couldn't resend the code — try again shortly.");
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="title" style={styles.centered}>
          Enter the code
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          Sent to {phoneNumber} ·{" "}
          <ThemedText variant="body" style={styles.link} onPress={() => navigation.goBack()}>
            Change
          </ThemedText>
        </ThemedText>
        <OtpInput value={code} onChangeText={setCode} autoFocus />
        {error && (
          <ThemedText variant="caption" style={[styles.centered, styles.error]}>
            {error}
          </ThemedText>
        )}
        <ThemedText variant="caption" style={styles.centered}>
          {secondsLeft > 0 ? (
            `Resend code in 0:${String(secondsLeft).padStart(2, "0")}`
          ) : (
            <ThemedText variant="caption" style={styles.link} onPress={handleResend}>
              Resend code
            </ThemedText>
          )}
        </ThemedText>
        {isSubmitting && <ActivityIndicator color={colors.primary} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  link: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
  },
  error: {
    color: colors.danger,
  },
});
