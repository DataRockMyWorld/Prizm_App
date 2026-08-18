import { Button, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, View } from "react-native";

import type { WorkerOnboardingStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerOnboardingStackParamList, "UnderReview">;

export function UnderReviewScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <ThemedText variant="title" style={styles.checkMark}>
            ✓
          </ThemedText>
        </View>
        <ThemedText variant="title" style={styles.centered}>
          You're under review
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          We'll notify you within 24 hours. Keep browsing jobs in the meantime.
        </ThemedText>
        <Button
          label="Back to Jobs"
          variant="secondary"
          onPress={() => navigation.popToTop()}
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: colors.textInverse,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  button: {
    width: "100%",
  },
});
