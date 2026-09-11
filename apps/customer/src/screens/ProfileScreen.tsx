import { Address, deleteAddress, getCustomerProfileStats, listAddresses, listMyJobs, updateProfile, useAuth } from "@prizm/api";
import { Button, Card, fontFamily, ProfileHero, Screen, SettingsRow, spacing, StatCard, ThemedText, colors } from "@prizm/ui";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { isActiveJobStatus } from "../jobsTab/jobsTabGrouping";
import { formatMemberSince } from "../profile/formatMemberSince";

export function ProfileScreen() {
  const { accessToken, profile, setProfile, clearSession } = useAuth();
  const navigation = useNavigation<any>();
  const [requestsCompleted, setRequestsCompleted] = useState(0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isCheckingDeleteEligibility, setIsCheckingDeleteEligibility] = useState(false);

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

  const handleDeleteAccountPress = async () => {
    if (!accessToken || isCheckingDeleteEligibility) return;
    setIsCheckingDeleteEligibility(true);
    try {
      const jobs = await listMyJobs(accessToken);
      const blockingJob = jobs.find((job) => isActiveJobStatus(job.status));
      if (blockingJob) {
        navigation.navigate("DeleteAccountBlocked", { job: blockingJob });
      } else {
        navigation.navigate("DeleteAccountWarning");
      }
    } finally {
      setIsCheckingDeleteEligibility(false);
    }
  };

  return (
    <Screen edges={["top", "bottom"]} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
            style={styles.definedCard}
            items={[
              { value: String(requestsCompleted), label: "Requests completed" },
              { value: formatMemberSince(profile?.date_joined), label: "Member since" },
            ]}
          />

          <ThemedText variant="caption" style={styles.sectionLabel}>
            SAVED ADDRESSES
          </ThemedText>
          <Card style={[styles.definedCard, styles.addressesCard]}>
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
          </Card>
          <Pressable
            onPress={() => navigation.navigate("AddressForm", {})}
            style={styles.addAddressPill}
            hitSlop={8}
          >
            <ThemedText variant="body" style={styles.addAddressText}>
              + Add address
            </ThemedText>
          </Pressable>

          <ThemedText variant="caption" style={styles.sectionLabel}>
            ACCOUNT
          </ThemedText>
          <Card style={styles.definedCard}>
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
          <Button label="Log out" variant="primary" onPress={clearSession} />
          <Card style={[styles.definedCard, styles.deleteCard]}>
            <Pressable onPress={handleDeleteAccountPress} style={styles.deleteRow}>
              <ThemedText variant="subtitle" style={styles.deleteText}>
                Delete account
              </ThemedText>
              <ThemedText variant="caption" style={styles.deleteSubtitle}>
                Permanently removes your profile and personal information
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
  // Without an explicit flex here, RN sizes the ScrollView to its content
  // instead of clipping it to the screen, so long content just overflows
  // past the bottom with no way to scroll to it.
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    // The calm hero has no hard-edged background to visually justify an
    // overlap (unlike the worker variant's gradient) — a real gap, not a
    // negative margin, or the StatCard covers the subtitle text. Bumped
    // from spacing.sm — that read as too tight against the hero below it.
    marginTop: spacing.lg,
  },
  // Card's own default border/shadow (packages/ui/src/components/Card.tsx)
  // is too close in tone to this screen's pageBackground to read as
  // separation (border #ECE7E2 against page #F1ECE7 is barely
  // distinguishable) — this screen-local override gives every card here a
  // slightly darker, still-subtle border plus a bit more shadow, matching
  // the approved hi-fi's visible-but-faint card definition. Deliberately
  // not changed at the shared Card level — that would touch every card in
  // both apps, well beyond this screen's scope.
  definedCard: {
    borderWidth: 1.5,
    borderColor: "#D9CEC0",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addressesCard: {
    padding: spacing.lg,
  },
  emptyText: {},
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.textSecondary,
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
  // "+ Add address" is its own dashed-pill element below the addresses
  // card (approved hi-fi), not a plain text link inside it.
  addAddressPill: {
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D8D0C4",
  },
  addAddressText: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bold,
  },
  deleteCard: {
    padding: 0,
    overflow: "hidden",
  },
  deleteRow: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fontFamily.bold,
  },
  deleteSubtitle: {
    textAlign: "center",
    marginTop: 2,
  },
});
