import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { colors, fontFamily, fontSize, spacing } from "../tokens";
import { Card } from "./Card";
import { ThemedText } from "./ThemedText";

export interface StatCardItem {
  value: string;
  label: string;
}

export interface StatCardProps {
  items: StatCardItem[];
  style?: StyleProp<ViewStyle>;
}

/** A row of stat cells inside a Card — worker Profile's "Jobs / Member
 * since", customer Profile's "Requests completed / Member since". Not
 * hardcoded to exactly two cells, so a third stat later doesn't require
 * touching this component again. */
export function StatCard({ items, style }: StatCardProps) {
  return (
    <Card style={[styles.card, style]}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          <View style={styles.cell}>
            <ThemedText variant="body" style={styles.value}>
              {item.value}
            </ThemedText>
            <ThemedText variant="caption" style={styles.label}>
              {item.label.toUpperCase()}
            </ThemedText>
          </View>
          {index < items.length - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    // flex-start, not center: centering each cell as a whole block means a
    // cell whose label wraps to two lines (e.g. "Requests completed" at a
    // narrow width) ends up taller, and centering that taller block pushes
    // its value up relative to a cell with a one-line label — flex-start
    // anchors every value to the same top regardless of label length.
    alignItems: "flex-start",
    paddingVertical: spacing.lg,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  label: {
    letterSpacing: 0.4,
    // A longer label ("Requests completed") wraps to two lines at
    // narrower widths — without an explicit textAlign, RN left-aligns
    // each wrapped line individually even inside a centered container,
    // so it reads off-center under the value above it.
    textAlign: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: spacing.xs,
    // colors.border (#ECE7E2) barely registers against a white Card —
    // same low-contrast issue already fixed elsewhere this session
    // (PinDots, rating stars, the job-status timeline dots).
    backgroundColor: colors.textSecondary,
  },
});
