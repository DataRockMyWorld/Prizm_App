import { Card, Screen, ThemedText, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet } from "react-native";

export function ProfileScreen() {
  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Profile
      </ThemedText>
      <Card>
        <ThemedText variant="subtitle">Not signed in</ThemedText>
        <ThemedText variant="caption">
          The phone/OTP/PIN sign-in flow is wired up in a later step.
        </ThemedText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
});
