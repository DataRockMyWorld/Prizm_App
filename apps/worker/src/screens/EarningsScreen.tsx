import { Card, Screen, ThemedText, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet } from "react-native";

export function EarningsScreen() {
  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Earnings
      </ThemedText>
      <Card>
        <ThemedText variant="subtitle">Nothing to show yet</ThemedText>
        <ThemedText variant="caption">
          Your completed job payouts will show up here once payments are wired in.
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
