import { ServiceCategory, listCategories, useAuth } from "@prizm/api";
import {
  BrandHeader,
  Button,
  Screen,
  TextField,
  ThemedText,
  colors,
  fontFamily,
  fontSize,
  radii,
  spacing,
} from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Dimensions, Image, Keyboard, Pressable, StyleSheet, View } from "react-native";

import { filterCategoriesByQuery } from "../home/filterCategories";
import { SERVICE_IMAGES } from "../serviceImages";

// 4-across compact circular thumbnail row (approved hi-fi, "Tiles ·
// Option 3") — replaces the earlier 2-column rectangular image cards.
// `aspectRatio` combined with a percentage `flexBasis` collapses tiles to
// zero size on this RN/Yoga version (verified live on device), so this
// computes explicit pixel sizes instead — subtracting both the Screen's
// own horizontal padding AND browseSection's padding, since the grid is
// nested inside that tinted container, not directly against the screen
// edge.
const THUMBNAIL_COLUMNS = 4;
const THUMBNAIL_GAP = spacing.sm;
// Math.floor, not Math.round — rounding up here can overflow the row's
// available width by a pixel or two (4 items + 3 gaps), which is enough
// for RN's flexbox to wrap the 4th item to a second row instead of
// fitting all 4 across (confirmed live: Plumbing was dropping to its own
// row). Flooring guarantees the row always fits with room to spare.
const THUMBNAIL_SIZE = Math.floor(
  (Dimensions.get("window").width - spacing.md * 4 - THUMBNAIL_GAP * (THUMBNAIL_COLUMNS - 1)) /
    THUMBNAIL_COLUMNS
);

export function HomeScreen() {
  const { accessToken, profile } = useAuth();
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    listCategories(accessToken)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [accessToken]);

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const visibleCategories = filterCategoriesByQuery(categories, searchQuery);

  return (
    <Screen>
      {/* Tap-outside-to-dismiss is now handled globally by Screen itself —
       * see packages/ui/src/components/Screen.tsx. */}
      <View style={styles.body}>
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

        <TextField
          placeholder="Search for a service..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          style={styles.search}
        />

        <View style={styles.browseSection}>
          <View style={styles.sectionHeader}>
            <ThemedText variant="caption" style={styles.sectionLabel}>
              BROWSE SERVICES
            </ThemedText>
            <ThemedText variant="caption" style={styles.seeAll}>
              See all
            </ThemedText>
          </View>

          {searchQuery.trim() && visibleCategories.length === 0 ? (
            <ThemedText variant="caption" style={styles.noResults}>
              No services match "{searchQuery.trim()}"
            </ThemedText>
          ) : (
            <View style={styles.grid}>
              {visibleCategories.map((category) => {
                const image = SERVICE_IMAGES[category.slug];
                return (
                  <Pressable
                    key={category.id}
                    style={styles.thumbnailItem}
                    onPress={() => navigation.navigate("RequestSubmission", { categoryId: category.id })}
                  >
                    {image ? (
                      <Image source={image} style={styles.thumbnailImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumbnailImage, styles.thumbnailFallback]} />
                    )}
                    <ThemedText style={styles.thumbnailLabel} numberOfLines={2}>
                      {category.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.spacer} />

        <Button
          label="Request a Service"
          onPress={() => navigation.navigate("RequestSubmission", {})}
          style={styles.requestButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
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
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  search: {},
  // Gives the Browse Services section its own visually distinct band
  // (subtle tint, not a hard divider line) — separates it from the
  // greeting/search section above and whatever sits below (see hi-fi).
  browseSection: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  seeAll: {
    color: colors.primary,
  },
  noResults: {
    paddingVertical: spacing.md,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: THUMBNAIL_GAP,
  },
  thumbnailItem: {
    width: THUMBNAIL_SIZE,
    alignItems: "center",
  },
  thumbnailImage: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: THUMBNAIL_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thumbnailFallback: {
    backgroundColor: "#FDE3D5",
  },
  thumbnailLabel: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    textAlign: "center",
  },
  spacer: {
    flex: 1,
  },
  requestButton: {
    marginBottom: spacing.md,
  },
});
