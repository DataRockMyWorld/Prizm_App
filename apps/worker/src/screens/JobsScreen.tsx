import { Card, Screen, ThemedText, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet } from "react-native";

export function JobsScreen() {
  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Jobs
      </ThemedText>
      <Card>
        <ThemedText variant="subtitle">No jobs yet</ThemedText>
        <ThemedText variant="caption">
          Your active and past jobs will show up here once the job lifecycle API is wired in.
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
