import { ServiceCategory, listCategories, useAuth } from "@prizm/api";
import { Card, GradientBackground, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export function HomeScreen() {
  const { accessToken, profile } = useAuth();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    listCategories(accessToken)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [accessToken]);

  return (
    <Screen edges={["bottom"]}>
      <GradientBackground style={styles.header}>
        <ThemedText variant="title" style={styles.headerTitle}>
          Hello, {profile?.full_name || "there"} 👋
        </ThemedText>
        <ThemedText variant="body" style={styles.headerSubtitle}>
          What service do you need today?
        </ThemedText>
      </GradientBackground>

      <View style={styles.body}>
        {categories.map((category) => (
          <Card key={category.id} style={styles.categoryCard}>
            <ThemedText variant="subtitle">{category.name}</ThemedText>
            <ThemedText variant="caption">
              Est. N${category.estimate_min}–{category.estimate_max}
            </ThemedText>
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
