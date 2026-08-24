import { Address, deleteAddress, getCustomerProfileStats, listAddresses, updateProfile, useAuth } from "@prizm/api";
import { Card, ProfileHero, Screen, SettingsRow, spacing, StatCard, ThemedText, colors } from "@prizm/ui";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { formatMemberSince } from "../profile/formatMemberSince";

export function ProfileScreen() {
  const { accessToken, profile, setProfile, clearSession } = useAuth();
  const navigation = useNavigation<any>();
  const [requestsCompleted, setRequestsCompleted] = useState(0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [stats, addressList] = await Promise.all([
        getCustomerProfileStats(accessToken),
        listAddresses(accessToken),
      ]);
      setRequestsCompleted(stats.requests_completed);
      setAddresses(addressList);
    } catch {
      // Leave whatever state the screen already had rather than crashing.
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !accessToken) return;
    setIsUploadingPhoto(true);
    try {
      const updated = await updateProfile(accessToken, { photoUri: result.assets[0].uri });
      setProfile(updated);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const saveName = async (full_name: string) => {
    if (!accessToken) return;
    const updated = await updateProfile(accessToken, { full_name });
    setProfile(updated);
  };

  const confirmDelete = (address: Address) => {
    Alert.alert("Delete address?", `Remove "${address.label}" from your saved addresses?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!accessToken) return;
          await deleteAddress(accessToken, address.id);
          setAddresses((current) => current.filter((a) => a.id !== address.id));
        },
      },
    ]);
  };

  return (
    <Screen edges={["top", "bottom"]} style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ProfileHero
          variant="customer"
          photo={profile?.photo ?? null}
          fullName={profile?.full_name ?? ""}
          onPickPhoto={pickPhoto}
          onSaveName={saveName}
          isUploadingPhoto={isUploadingPhoto}
          subtitle={`Member since ${formatMemberSince(profile?.date_joined)}`}
        />

        <View style={styles.content}>
          <StatCard
            items={[
              { value: String(requestsCompleted), label: "Requests completed" },
              { value: formatMemberSince(profile?.date_joined), label: "Member since" },
            ]}
          />

          <ThemedText variant="caption" style={styles.sectionLabel}>
            SAVED ADDRESSES
          </ThemedText>
          <Card>
            {addresses.length === 0 && (
              <ThemedText variant="caption" style={styles.emptyText}>
                No saved addresses yet.
              </ThemedText>
            )}
            {addresses.map((address, index) => (
              <Pressable
                key={address.id}
                onPress={() => navigation.navigate("AddressForm", { address })}
                style={[styles.addressRow, index === 0 && styles.addressRowFirst]}
              >
                <Ionicons name="location" size={20} color={colors.primary} />
                <View style={styles.addressInfo}>
                  <ThemedText variant="body">{address.label}</ThemedText>
                  <ThemedText variant="caption">{address.address_text}</ThemedText>
                </View>
                <Pressable onPress={() => confirmDelete(address)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              </Pressable>
            ))}
            <Pressable
              onPress={() => navigation.navigate("AddressForm", {})}
              style={styles.addAddressLink}
              hitSlop={8}
            >
              <ThemedText variant="body" style={styles.addAddressText}>
                + Add address
              </ThemedText>
            </Pressable>
          </Card>

          <ThemedText variant="caption" style={styles.sectionLabel}>
            ACCOUNT
          </ThemedText>
          <Card>
            <SettingsRow
              label="Payment method"
              onPress={() => navigation.navigate("ComingSoon", { title: "Payment method" })}
              isFirst
            />
            <SettingsRow
              label="Notification preferences"
              onPress={() => navigation.navigate("ComingSoon", { title: "Notification preferences" })}
            />
            <SettingsRow label="Help & support" onPress={() => navigation.navigate("HelpSupport")} />
            <SettingsRow label="Safety tips" onPress={() => navigation.navigate("SafetyTips")} />
            <SettingsRow
              label="Terms & liability"
              detail={profile?.liability_acknowledged_at ? "Accepted" : undefined}
              onPress={() => navigation.navigate("TermsLiability")}
            />
          </Card>
          <Card style={styles.logoutCard}>
            <Pressable onPress={clearSession} style={styles.logoutRow}>
              <ThemedText variant="subtitle" style={styles.logoutText}>
                Log out
              </ThemedText>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    // The calm hero has no hard-edged background to visually justify an
    // overlap (unlike the worker variant's gradient) — just a small gap,
    // not a negative margin, or the StatCard covers the subtitle text.
    marginTop: spacing.sm,
  },
  emptyText: {},
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addressRowFirst: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  addressInfo: {
    flex: 1,
    gap: 2,
  },
  addAddressLink: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  addAddressText: {
    color: colors.primary,
    fontWeight: "700",
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  logoutCard: {
    padding: 0,
    overflow: "hidden",
  },
  logoutRow: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  logoutText: {
    color: colors.primary,
  },
});
