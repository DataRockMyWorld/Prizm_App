import { Card, Screen, ThemedText, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet } from "react-native";

export function MessagesScreen() {
  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Messages
      </ThemedText>
      <Card>
        <ThemedText variant="subtitle">No messages yet</ThemedText>
        <ThemedText variant="caption">
          Job chat threads will show up here once chat is wired in.
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
