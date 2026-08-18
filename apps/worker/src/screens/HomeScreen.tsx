import { Badge, Button, Card, GradientBackground, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

export function HomeScreen() {
  const [isOnline, setIsOnline] = useState(false);

  return (
    <Screen edges={["bottom"]}>
      <GradientBackground style={styles.header}>
        <ThemedText variant="title" style={styles.headerTitle}>
          Prizm Worker
        </ThemedText>
        <ThemedText variant="body" style={styles.headerSubtitle}>
          {isOnline ? "You're online — nearby jobs will come to you" : "You're offline"}
        </ThemedText>
      </GradientBackground>

      <View style={styles.body}>
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="subtitle">Go online</ThemedText>
              <ThemedText variant="caption">
                Wired up to the matching API in a later step.
              </ThemedText>
            </View>
            <Badge label={isOnline ? "Online" : "Offline"} tone={isOnline ? "verified" : "neutral"} />
          </View>
          <Button
            label={isOnline ? "Go offline" : "Go online"}
            onPress={() => setIsOnline((v) => !v)}
            variant={isOnline ? "secondary" : "primary"}
            style={styles.toggleButton}
          />
        </Card>

        <Card style={styles.emptyStateCard}>
          <ThemedText variant="subtitle">Nearby jobs</ThemedText>
          <ThemedText variant="caption">
            Estimate ranges for open requests in your categories will show up here once you're
            online.
          </ThemedText>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    color: colors.textInverse,
  },
  headerSubtitle: {
    color: colors.textInverse,
    marginTop: spacing.xs,
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  toggleButton: {
    marginTop: spacing.md,
  },
  emptyStateCard: {
    alignItems: "flex-start",
  },
});
