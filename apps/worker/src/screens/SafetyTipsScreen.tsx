import { Card, Screen, ThemedText, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

const TIPS = [
  {
    title: "Confirm before you go",
    body: "Check the job's category, address, and any notes match what you expect before heading out.",
  },
  {
    title: "Let someone know your plans",
    body: "Share where you're headed and roughly when you expect to finish, especially for a new customer.",
  },
  {
    title: "Trust your instincts",
    body: "If a situation feels unsafe once you arrive, it's okay to leave — report it through the app afterward.",
  },
  {
    title: "Keep it in the app",
    body: "Coordinate timing and pricing through Prism's chat and price-agreement flow, not side arrangements.",
  },
  {
    title: "Don't share personal contact details",
    body: "Use in-app chat for job coordination instead of exchanging personal phone numbers.",
  },
];

export function SafetyTipsScreen() {
  const navigation = useNavigation<any>();

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">Safety tips</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {TIPS.map((tip) => (
          <Card key={tip.title} style={styles.card}>
            <ThemedText variant="subtitle">{tip.title}</ThemedText>
            <ThemedText variant="body">{tip.body}</ThemedText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  headerSpacer: {
    width: 24,
  },
  card: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
});
