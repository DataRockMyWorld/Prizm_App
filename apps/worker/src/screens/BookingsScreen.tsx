import { Card, Screen, ThemedText, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet } from "react-native";

export function BookingsScreen() {
  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Bookings
      </ThemedText>
      <Card>
        <ThemedText variant="subtitle">No bookings yet</ThemedText>
        <ThemedText variant="caption">
          Your scheduled jobs will show up here once the active-job flow is wired in.
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
