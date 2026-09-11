import { Card, Screen, ThemedText, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

const TIPS = [
  {
    title: "Check the Verified badge",
    body: "It means the worker's ID has been reviewed and approved before they're allowed to accept jobs.",
  },
  {
    title: "Share your address only through the app",
    body: "Your job's address is passed to the matched worker automatically — no need to send it elsewhere.",
  },
  {
    title: "Let someone know",
    body: "If it's your first time using a particular service, let a friend or family member know a worker is coming.",
  },
  {
    title: "Keep it in the app",
    body: "Coordinate timing through chat, and confirm the final price in the app rather than agreeing to cash side-deals.",
  },
  {
    title: "Something feel off?",
    body: "Use \"Report a problem\" on the job — safety concerns are routed to our review team.",
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

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
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
  // Without an explicit flex here, RN sizes the ScrollView to its content
  // instead of clipping it to the screen, so long content just overflows
  // past the bottom with no way to scroll to it.
  scroll: {
    flex: 1,
  },
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
