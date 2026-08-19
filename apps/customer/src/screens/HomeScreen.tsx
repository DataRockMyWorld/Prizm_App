import { ServiceCategory, listCategories, useAuth } from "@prizm/api";
import { BrandHeader, Button, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export function HomeScreen() {
  const { accessToken, profile } = useAuth();
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    listCategories(accessToken)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [accessToken]);

  return (
    <Screen>
      <BrandHeader
        rightAccessory={
          <View style={styles.avatarWrap}>
            <View style={styles.avatarPlaceholder} />
            <View style={styles.notificationDot} />
          </View>
        }
      />

      <ThemedText variant="title" style={styles.greeting}>
        Hello, {profile?.full_name || "there"} 👋
      </ThemedText>
      <ThemedText variant="caption" style={styles.subtitle}>
        What service do you need today?
      </ThemedText>

      <TextField placeholder="Search for a service..." editable={false} style={styles.search} />

      <View style={styles.grid}>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            style={styles.gridItem}
            onPress={() => navigation.navigate("RequestSubmission", { categoryId: category.id })}
          >
            <View style={styles.categoryIcon} />
            <ThemedText variant="caption" style={styles.gridLabel}>
              {category.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.spacer} />

      <Button
        label="Request a Service"
        onPress={() => navigation.navigate("RequestSubmission", {})}
        style={styles.requestButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    width: 26,
    height: 26,
  },
  avatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
  },
  notificationDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  greeting: {
    marginTop: spacing.md,
  },
  subtitle: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  search: {},
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  gridItem: {
    flexBasis: "31%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  categoryIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#FDE3D5",
  },
  gridLabel: {
    textAlign: "center",
  },
  spacer: {
    flex: 1,
  },
  requestButton: {
    marginBottom: spacing.md,
  },
});
