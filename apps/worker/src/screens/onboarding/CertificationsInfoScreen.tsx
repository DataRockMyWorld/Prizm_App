import { Badge, Button, Card, fontFamily, ProgressBar, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import type { WorkerOnboardingStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerOnboardingStackParamList, "CertificationsInfo">;

const TIPS = [
  "Make sure the whole certificate is in frame and fully legible.",
  "It should clearly show the service category it covers.",
];

/** Onboarding-only entry point for the (optional) certifications step
 * (screen 9 in the hi-fi flow) — instructions only. Reached only from the
 * onboarding flow itself: the Profile tab's "+ Add another certificate"
 * keeps navigating straight to CertificationsScreen with
 * `returnTo: "profile"`, bypassing this screen entirely — there's no
 * "step 2 of 2" framing once someone's already fully onboarded. */
export function CertificationsInfoScreen({ navigation }: Props) {
  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <ThemedText variant="caption" style={styles.step}>
          STEP 2 OF 2
        </ThemedText>
        <ProgressBar progress={1} />
        <View style={styles.badgeRow}>
          <Badge label="OPTIONAL" tone="neutral" />
        </View>
        <ThemedText variant="title">Add certifications</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          Optional — upload certificates for the services you offer to earn a Certified badge on
          your profile
        </ThemedText>

        <Card style={styles.tipsCard}>
          <ThemedText variant="caption" style={styles.tipsLabel}>
            TIPS
          </ThemedText>
          {TIPS.map((tip, index) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipNumber}>
                <ThemedText variant="caption" style={styles.tipNumberText}>
                  {index + 1}
                </ThemedText>
              </View>
              <ThemedText variant="caption" style={styles.tipText}>
                {tip}
              </ThemedText>
            </View>
          ))}
        </Card>

        <Card style={styles.badgePreviewCard}>
          <Badge label="✓ Certified" tone="certified" />
          <ThemedText variant="caption" style={styles.badgePreviewText}>
            Once a certificate is approved, this badge shows on your profile and on the card
            customers see when they're matched with you.
          </ThemedText>
        </Card>

        <View style={styles.spacer} />
        <Button label="Continue" onPress={() => navigation.navigate("Certifications")} />
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
  content: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  step: {
    color: "#FF6C22",
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: "row",
  },
  subtitle: {
    marginTop: -spacing.sm,
  },
  tipsCard: {
    backgroundColor: colors.surfaceMuted,
    gap: spacing.xs,
  },
  tipsLabel: {
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  tipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  tipNumber: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tipNumberText: {
    color: colors.textInverse,
    fontFamily: fontFamily.extraBold,
    fontSize: 9,
  },
  tipText: {
    flex: 1,
    fontFamily: fontFamily.medium,
  },
  badgePreviewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  badgePreviewText: {
    flex: 1,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
});
