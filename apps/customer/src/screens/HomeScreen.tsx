import { ServiceCategory, listCategories, useAuth } from "@prizm/api";
import { BrandHeader, Button, Screen, TextField, ThemedText, colors, radii, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Dimensions, Image, Pressable, StyleSheet, View } from "react-native";

import { SERVICE_IMAGES } from "../serviceImages";

// `aspectRatio` combined with a percentage `flexBasis` collapses tiles to
// zero size on this RN/Yoga version (verified live on device) — compute
// explicit pixel sizes instead of relying on that combination.
const GRID_GAP = spacing.md;
const CARD_WIDTH = (Dimensions.get("window").width - spacing.md * 2 - GRID_GAP) / 2;
const CARD_IMAGE_HEIGHT = Math.round(CARD_WIDTH * 0.75); // matches the 4:3 source photos

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

  const firstName = profile?.full_name?.split(" ")[0] || "there";

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
        Hello, {firstName} 👋
      </ThemedText>
      <ThemedText variant="caption" style={styles.subtitle}>
        What service do you need today?
      </ThemedText>

      <TextField placeholder="Search for a service..." editable={false} style={styles.search} />

      <View style={styles.divider} />

      <View style={styles.sectionHeader}>
        <ThemedText variant="caption" style={styles.sectionLabel}>
          BROWSE SERVICES
        </ThemedText>
        <ThemedText variant="caption" style={styles.seeAll}>
          See all
        </ThemedText>
      </View>

      <View style={styles.grid}>
        {categories.map((category) => {
          const image = SERVICE_IMAGES[category.slug];
          return (
            <Pressable
              key={category.id}
              style={styles.card}
              onPress={() => navigation.navigate("RequestSubmission", { categoryId: category.id })}
            >
              {image ? (
                <Image source={image} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImageFallback]} />
              )}
              <View style={styles.cardBody}>
                <ThemedText variant="subtitle">{category.name}</ThemedText>
              </View>
            </Pressable>
          );
        })}
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  seeAll: {
    color: colors.primary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardImage: {
    width: CARD_WIDTH,
    height: CARD_IMAGE_HEIGHT,
  },
  cardImageFallback: {
    backgroundColor: "#FDE3D5",
  },
  cardBody: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  spacer: {
    flex: 1,
  },
  requestButton: {
    marginBottom: spacing.md,
  },
});
