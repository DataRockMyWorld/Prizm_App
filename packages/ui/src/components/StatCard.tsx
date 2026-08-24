import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../tokens";
import { Card } from "./Card";
import { ThemedText } from "./ThemedText";

export interface StatCardItem {
  value: string;
  label: string;
}

export interface StatCardProps {
  items: StatCardItem[];
}

/** A row of stat cells inside a Card — worker Profile's "Jobs / Member
 * since", customer Profile's "Requests completed / Member since". Not
 * hardcoded to exactly two cells, so a third stat later doesn't require
 * touching this component again. */
export function StatCard({ items }: StatCardProps) {
  return (
    <Card style={styles.card}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          <View style={styles.cell}>
            <ThemedText variant="title" style={styles.value}>
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
    alignItems: "center",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  value: {
    color: colors.textPrimary,
  },
  label: {
    letterSpacing: 0.4,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
  },
});
