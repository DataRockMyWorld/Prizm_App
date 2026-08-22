import React from "react";
import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { prismMarkWhite } from "../assets";
import { spacing } from "../tokens";
import { GradientBackground } from "./GradientBackground";

export interface SplashViewProps {
  /** Emoji shown in the badge below the wordmark, e.g. "🔧" or "🏠". */
  icon: string;
}

/**
 * Full-screen branded splash: the brand gradient as a true background, with
 * `prismMarkWhite` (a transparent-background cutout of the mark + wordmark,
 * derived from prism-logo-reverse.png) centered on top, sized relative to
 * screen width to match the hi-fi splash mockups (S3/S4). Being transparent
 * rather than a baked-in gradient square, it sits on `GradientBackground`
 * with no visible seam at any size.
 */
export function SplashView({ icon }: SplashViewProps) {
  // `Image` needs an explicit numeric width/height to size reliably on this
  // RN version — percentage width + aspectRatio alone rendered far too
  // large (same underlying quirk as the earlier absolute-positioning fix).
  const { width: screenWidth } = useWindowDimensions();
  const logoSize = screenWidth * 0.81;

  return (
    <GradientBackground style={styles.container}>
      <Image
        source={prismMarkWhite}
        style={{ width: logoSize, height: logoSize }}
        resizeMode="contain"
      />
      <View style={styles.iconBadge}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadge: {
    marginTop: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
  },
});
