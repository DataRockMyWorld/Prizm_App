import { Button, Card, fontFamily, ProgressBar, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import type { WorkerOnboardingStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerOnboardingStackParamList, "IdVerificationInfo">;

const TIPS = [
  "Capture the front of your ID first, then the back.",
  "Make sure your full name, date of birth and ID number are clearly visible.",
  "Check the ID is valid and not expired, with no glare, blur or damage.",
];

/** Entry point of the ID-verification step (screen 7 in the hi-fi flow) —
 * instructions only, no data collection. The actual capture happens on
 * IdUploadScreen next. Split out so a worker reads what's expected before
 * they're holding their ID up to the camera, not while. */
export function IdVerificationInfoScreen({ navigation }: Props) {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ThemedText variant="caption" style={styles.step}>
          STEP 1 OF 2
        </ThemedText>
        <ProgressBar progress={0.5} />
        <ThemedText variant="title" style={styles.title}>
          Unlock your earning potential
        </ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          Verify your identity to start accepting paid jobs
        </ThemedText>

        <Card style={styles.tipsCard}>
          <ThemedText variant="caption" style={styles.tipsLabel}>
            BEFORE YOU START
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

        {/* A schematic mockup, not a real photo — matches the hi-fi wireframe's
            own approach (its "example" card is built from plain shapes too,
            not an image asset). Nothing to meaningfully zoom into on a
            schematic, so this intentionally skips the wireframe's "Tap to
            zoom" affordance rather than promising a zoom that reveals nothing
            new. */}
        <Card style={styles.exampleCard}>
          <View style={styles.exampleFrame}>
            <View style={styles.exampleId}>
              <View style={styles.examplePhoto} />
              <View style={styles.exampleLines}>
                <View style={[styles.exampleLine, { width: "80%" }]} />
                <View style={[styles.exampleLine, styles.exampleLineFaint, { width: "60%" }]} />
                <View style={[styles.exampleLine, styles.exampleLineFaint, { width: "70%" }]} />
                <View style={[styles.exampleLine, styles.exampleLineAccent, { width: "45%" }]} />
              </View>
            </View>
          </View>
          <View style={styles.exampleCaptionRow}>
            <ThemedText style={styles.exampleCheck}>✓</ThemedText>
            <ThemedText variant="caption" style={styles.exampleCaption}>
              Example — flat, fully in frame, all text legible
            </ThemedText>
          </View>
        </Card>

        <View style={styles.spacer} />
        <Button label="Continue" onPress={() => navigation.navigate("IdUpload")} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  step: {
    color: "#FF6C22",
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
  },
  title: {},
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
  exampleCard: {
    padding: 0,
    overflow: "hidden",
  },
  exampleFrame: {
    backgroundColor: "#F4F2EF",
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  exampleId: {
    width: 150,
    height: 92,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: "#E7E5E2",
    padding: 9,
    flexDirection: "row",
    gap: 8,
  },
  examplePhoto: {
    width: 28,
    height: 34,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },
  exampleLines: {
    flex: 1,
    gap: 5,
    paddingTop: 2,
  },
  exampleLine: {
    height: 5,
    borderRadius: 2,
    backgroundColor: "#D8D4CF",
  },
  exampleLineFaint: {
    height: 4,
    backgroundColor: "#E7E5E2",
  },
  exampleLineAccent: {
    height: 4,
    backgroundColor: "#FFD9C2",
  },
  exampleCaptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F4F2EF",
  },
  exampleCheck: {
    color: colors.success,
    fontFamily: fontFamily.extraBold,
    fontSize: 12,
  },
  exampleCaption: {
    fontFamily: fontFamily.medium,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
});
