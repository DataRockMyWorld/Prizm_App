import { Badge, Card, Screen, ThemedText, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet, View } from "react-native";

export function ProfileScreen() {
  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Profile
      </ThemedText>
      <Card>
        <View style={styles.row}>
          <ThemedText variant="subtitle">Verification</ThemedText>
          <Badge label="Not submitted" tone="neutral" />
        </View>
        <ThemedText variant="caption" style={styles.caption}>
          ID upload and the phone/OTP/PIN sign-in flow are wired up in a later step.
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  caption: {
    marginTop: spacing.sm,
  },
});
