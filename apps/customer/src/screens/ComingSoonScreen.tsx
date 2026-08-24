import { Screen, ThemedText, spacing } from "@prizm/ui";
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

/** Generic placeholder for an Account row with no feature behind it yet
 * (Payment method, Notification preferences) — shown instead of pretending
 * functionality exists before payments/push are actually built. */
export function ComingSoonScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const title: string = route.params?.title ?? "Coming soon";

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">{title}</ThemedText>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.body}>
        <ThemedText style={styles.icon}>🚧</ThemedText>
        <ThemedText variant="subtitle" style={styles.centered}>
          Coming soon
        </ThemedText>
        <ThemedText variant="body" style={styles.centered}>
          {title} isn't available yet — we'll let you know when it is.
        </ThemedText>
      </View>
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
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  centered: {
    textAlign: "center",
  },
});
