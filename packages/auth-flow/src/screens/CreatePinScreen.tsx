import { Screen, ThemedText, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { PIN_LENGTH, PinEntry } from "../components/PinEntry";
import type { AuthStackParamList } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "CreatePin">;

export function CreatePinScreen({ navigation, route }: Props) {
  const { phoneNumber, otpToken } = route.params;
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      navigation.navigate("ConfirmPin", { phoneNumber, otpToken, pin });
    }
  }, [pin, navigation, phoneNumber, otpToken]);

  return (
    <Screen>
      <View style={styles.content}>
        <ThemedText variant="caption" style={styles.step}>
          STEP 1 OF 2
        </ThemedText>
        <ThemedText variant="title">Create a PIN</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          You'll use this to log in quickly next time
        </ThemedText>
        <View style={styles.dotsWrap}>
          <PinEntry value={pin} onChangeText={setPin} autoFocus />
        </View>
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
});
