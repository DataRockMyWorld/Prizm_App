import { Card, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

// Placeholder contact details — update before launch (see PROGRESS.md).
const SUPPORT_EMAIL = "support@prism.app";
const SUPPORT_HOURS = "Mon–Fri, 8am–5pm";

export function HelpSupportScreen() {
  const navigation = useNavigation<any>();

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">Help &amp; support</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.card}>
        <ThemedText variant="caption" style={styles.label}>
          EMAIL US
        </ThemedText>
        <ThemedText variant="body">{SUPPORT_EMAIL}</ThemedText>
      </Card>

      <Card style={styles.card}>
        <ThemedText variant="caption" style={styles.label}>
          HOURS
        </ThemedText>
        <ThemedText variant="body">{SUPPORT_HOURS}</ThemedText>
      </Card>

      <ThemedText variant="caption" style={styles.note}>
        Having trouble with a specific job? Use "Report a problem" on that job instead — it
        reaches our review team directly.
      </ThemedText>
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
    gap: 2,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  note: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
});
