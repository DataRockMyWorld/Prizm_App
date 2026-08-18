import { Card, GradientBackground, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet, View } from "react-native";

const PLACEHOLDER_CATEGORIES = [
  { name: "Cleaning", estimate: "Est. N$150–300" },
  { name: "Plumbing", estimate: "Est. N$200–500" },
  { name: "Electrical", estimate: "Est. N$250–600" },
];

export function HomeScreen() {
  return (
    <Screen edges={["bottom"]}>
      <GradientBackground style={styles.header}>
        <ThemedText variant="title" style={styles.headerTitle}>
          What do you need done?
        </ThemedText>
        <ThemedText variant="body" style={styles.headerSubtitle}>
          Request a service and get matched with a verified worker nearby.
        </ThemedText>
      </GradientBackground>

      <View style={styles.body}>
        {PLACEHOLDER_CATEGORIES.map((category) => (
          <Card key={category.name} style={styles.categoryCard}>
            <ThemedText variant="subtitle">{category.name}</ThemedText>
            <ThemedText variant="caption">{category.estimate}</ThemedText>
          </Card>
        ))}
        <ThemedText variant="caption" style={styles.footnote}>
          Tapping a category will start the request flow once it's wired up to the API.
        </ThemedText>
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
    gap: spacing.sm,
  },
  categoryCard: {
    alignItems: "flex-start",
  },
  footnote: {
    marginTop: spacing.sm,
  },
});
