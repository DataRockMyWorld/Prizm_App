import { useAuth } from "@prizm/api";
import { Button, Card, fontFamily, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

const ERASED = [
  "Your name, photo, phone number and email",
  "Your saved addresses",
  "Your saved payment method",
];

const RETAINED = [
  "Your job history, ratings and reviews for workers you've hired",
  "Your messages",
];

/** D1b — warning screen, first step of account deletion. "What is erased"
 * intentionally excludes job history/ratings/messages — those are
 * anonymized and kept (see backend DeleteAccountView), not actually
 * erased, so claiming otherwise here would be wrong. See
 * docs/prds/app-store-readiness.md §5d for the full reasoning. */
export function DeleteAccountWarningScreen() {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ThemedText variant="title">Delete your account</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          Please read what this means before you continue. Deletion is permanent.
        </ThemedText>

        <ThemedText variant="caption" style={styles.sectionLabel}>
          WHAT IS ERASED
        </ThemedText>
        <Card style={styles.listCard}>
          {ERASED.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={[styles.dot, styles.dotErased]} />
              <ThemedText variant="body" style={styles.bulletText}>
                {item}
              </ThemedText>
            </View>
          ))}
        </Card>

        <ThemedText variant="caption" style={styles.sectionLabel}>
          WHAT IS RETAINED
        </ThemedText>
        <Card style={styles.retainedCard}>
          {RETAINED.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.dot} />
              <ThemedText variant="body" style={styles.bulletText}>
                {item} — anonymized and kept, no longer linked to your name
              </ThemedText>
            </View>
          ))}
          <View style={styles.bulletRow}>
            <View style={styles.dot} />
            <ThemedText variant="body" style={styles.bulletText}>
              Anonymized transaction and financial records — amounts, dates and tax entries —
              kept for the period required by Namibian tax and accounting law
            </ThemedText>
          </View>
        </Card>

        <ThemedText variant="caption" style={styles.footnote}>
          You cannot undo this. Using Prism again would mean signing up from scratch
          {firstName ? `, ${firstName}` : ""}.
        </ThemedText>

        <View style={styles.spacer} />
        <Button
          label="Continue"
          variant="dark"
          onPress={() => navigation.navigate("DeleteAccountPin")}
        />
        <Pressable onPress={() => navigation.goBack()} style={styles.keep} hitSlop={8}>
          <ThemedText variant="body" style={styles.centered}>
            Keep my account
          </ThemedText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
  },
  content: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  sectionLabel: {
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  listCard: {
    gap: spacing.xs,
  },
  retainedCard: {
    backgroundColor: colors.surfaceMuted,
    gap: spacing.xs,
  },
  bulletRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textSecondary,
    marginTop: 7,
  },
  dotErased: {
    backgroundColor: colors.danger,
  },
  bulletText: {
    flex: 1,
  },
  footnote: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
  keep: {
    marginTop: spacing.xs,
  },
  centered: {
    textAlign: "center",
  },
});
