import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../tokens";
import { GradientBackground } from "./GradientBackground";
import { ProfileHeader, ProfileHeaderProps } from "./ProfileHeader";
import { ThemedText } from "./ThemedText";

export type ProfileHeroVariant = "worker" | "customer";

export interface ProfileHeroProps
  extends Pick<
    ProfileHeaderProps,
    "photo" | "fullName" | "onPickPhoto" | "onSaveName" | "isUploadingPhoto"
  > {
  variant: ProfileHeroVariant;
  /** e.g. "Windhoek · Cleaning & Electrical" (worker) or "Member since Jun
   * 2025" (customer) — composed by the caller, this component just lays
   * it out. */
  subtitle?: string;
  /** Worker only: Verified/Certified `<Badge/>` elements, already built by
   * the caller. */
  badges?: React.ReactNode;
  /** Worker only: e.g. "★ 4.9 · 47 jobs completed" — composed by the
   * caller from `rating_average`/`jobs_completed`. */
  ratingLine?: string;
}

/** Profile-screen hero: full-bleed brand gradient for the worker app
 * (credibility content — badges, rating), a calm hero with a soft
 * gradient glow behind the avatar for the customer app (no credibility
 * content to show). Wraps ProfileHeader for the avatar-tap/name-edit
 * interaction rather than reimplementing it — only the surrounding
 * layout/background and optional badges/rating differ by variant. */
export function ProfileHero({
  variant,
  photo,
  fullName,
  onPickPhoto,
  onSaveName,
  isUploadingPhoto,
  subtitle,
  badges,
  ratingLine,
}: ProfileHeroProps) {
  const isWorker = variant === "worker";

  const header = (
    <ProfileHeader
      photo={photo}
      fullName={fullName}
      onPickPhoto={onPickPhoto}
      onSaveName={onSaveName}
      isUploadingPhoto={isUploadingPhoto}
      inverse={isWorker}
    />
  );

  if (isWorker) {
    return (
      <GradientBackground style={styles.gradientContainer}>
        {header}
        {subtitle ? (
          <ThemedText variant="body" style={styles.subtitleInverse}>
            {subtitle}
          </ThemedText>
        ) : null}
        {badges ? <View style={styles.badgeRow}>{badges}</View> : null}
        {ratingLine ? (
          <ThemedText variant="subtitle" style={styles.ratingLine}>
            {ratingLine}
          </ThemedText>
        ) : null}
      </GradientBackground>
    );
  }

  return (
    <View style={styles.calmContainer}>
      <View style={styles.glowWrapper} pointerEvents="none">
        <LinearGradient colors={colors.gradient} style={styles.glow} />
      </View>
      {header}
      {subtitle ? <ThemedText variant="body" style={styles.subtitleCustomer}>{subtitle}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    gap: spacing.xs,
  },
  subtitleInverse: {
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  ratingLine: {
    color: colors.textInverse,
    marginTop: spacing.xs,
  },
  calmContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  glowWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  glow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.16,
  },
  subtitleCustomer: {
    color: colors.textSecondary,
  },
});
