import { updateProfile, useAuth } from "@prizm/api";
import { Button, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { PostAuthStackParamList } from "../types";

type Props = NativeStackScreenProps<PostAuthStackParamList, "Biometric">;

export function BiometricScreen({ navigation }: Props) {
  const { accessToken, setProfile } = useAuth();
  const [isChecking, setIsChecking] = useState(false);

  const handleEnable = async () => {
    setIsChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Enable Face ID for Prizm",
        });
        if (result.success && accessToken) {
          const profile = await updateProfile(accessToken, { biometric_enabled: true });
          setProfile(profile);
        }
      }
    } finally {
      setIsChecking(false);
      navigation.navigate("Profile");
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.faceIdIcon}>
          <View style={styles.faceIdInner} />
        </View>
        <ThemedText variant="title" style={styles.centered}>
          Enable Face ID?
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          Log in faster next time using Face ID or your fingerprint instead of your PIN
        </ThemedText>
        <Button label="Enable Face ID" onPress={handleEnable} loading={isChecking} />
        <Pressable onPress={() => navigation.navigate("Profile")} style={styles.skip} hitSlop={8}>
          <ThemedText variant="body" style={styles.centered}>
            Not now
          </ThemedText>
        </Pressable>
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
  faceIdIcon: {
    width: 96,
    height: 96,
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  faceIdInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  skip: {
    marginTop: spacing.xs,
  },
});
