import { requestOtp } from "@prizm/api";
import { Button, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { AuthStackParamList } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "Phone">;

export function PhoneNumberScreen({ navigation }: Props) {
  const [localNumber, setLocalNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = localNumber.replace(/\D/g, "");
  const phoneNumber = `+264${digits}`;
  const isValid = digits.length >= 7;

  const handleContinue = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await requestOtp(phoneNumber);
      navigation.navigate("Otp", { phoneNumber });
    } catch {
      setError("Couldn't send a code. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.logo}>
          <ThemedText variant="title" style={styles.logoLetter}>
            P
          </ThemedText>
        </View>
        <ThemedText variant="title" style={styles.centered}>
          What's your number?
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          We'll text you a code to verify it's you
        </ThemedText>
        <TextField
          prefix={<ThemedText variant="subtitle">+264</ThemedText>}
          keyboardType="number-pad"
          placeholder="81 234 5678"
          value={localNumber}
          onChangeText={setLocalNumber}
          autoFocus
        />
        <ThemedText variant="caption" style={styles.centered}>
          Standard messaging rates may apply
        </ThemedText>
        {error && (
          <ThemedText variant="caption" style={[styles.centered, styles.error]}>
            {error}
          </ThemedText>
        )}
        <Button
          label="Continue"
          onPress={handleContinue}
          disabled={!isValid}
          loading={isSubmitting}
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
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  logoLetter: {
    color: colors.textInverse,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
  },
  button: {
    marginTop: spacing.lg,
  },
});
