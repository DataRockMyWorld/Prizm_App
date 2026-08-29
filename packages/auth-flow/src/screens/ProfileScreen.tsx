import { updateProfile, useAuth } from "@prizm/api";
import {
  Avatar,
  Button,
  Checkbox,
  fontFamily,
  Screen,
  TextField,
  ThemedText,
  colors,
  spacing,
} from "@prizm/ui";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { getNameFieldCopy } from "../profile/getNameFieldCopy";

const TERMS_TEXT =
  "Prism is a platform that connects independent service providers (workers) with customers who need services performed. " +
  "Prism is not an employer of workers and is not a party to the service agreement between a worker and a customer. " +
  "Both parties are responsible for their own conduct, and disputes are handled through Prism's in-app reporting tools.";

export function ProfileScreen() {
  const { accessToken, profile, setProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Role is already known by this point — RegisterView sets it at PIN
  // creation, and establishSessionFromTokens fetches the full profile right
  // after, before this screen is ever reached. The "customer" fallback below
  // only matters for the type checker, not real usage.
  const nameCopy = getNameFieldCopy(profile?.role ?? "customer");

  const canContinue = fullName.trim().length > 0 && agreed;

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (!canContinue || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await updateProfile(accessToken, {
        full_name: fullName.trim(),
        liability_acknowledged: true,
        photoUri,
      });
      setProfile(profile);
    } catch (err) {
      console.error("updateProfile failed", err);
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <ThemedText variant="title" style={styles.centered}>
          Who do we have here? 😊
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          Just the basics for now
        </ThemedText>
        <Avatar uri={photoUri} onPress={pickPhoto} />
        <View style={styles.nameFieldGroup}>
          {nameCopy.label && (
            <ThemedText variant="caption" style={styles.nameFieldLabel}>
              {nameCopy.label}
            </ThemedText>
          )}
          <TextField
            placeholder={nameCopy.placeholder}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            style={styles.nameField}
          />
        </View>
        <View style={styles.spacer} />
        <Checkbox checked={agreed} onToggle={() => setAgreed((v) => !v)}>
          <ThemedText variant="caption">
            I understand Prism connects independent service providers and customers, and is not
            an employer or party to the service agreement.{" "}
            <ThemedText
              variant="caption"
              style={styles.link}
              onPress={() => Alert.alert("Prism Terms", TERMS_TEXT)}
            >
              Read full terms
            </ThemedText>
          </ThemedText>
        </Checkbox>
        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        <Button
          label="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
          loading={isSubmitting}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  nameFieldGroup: {
    gap: spacing.xs,
  },
  nameFieldLabel: {
    fontFamily: fontFamily.bold,
  },
  nameField: {},
  spacer: {
    flex: 1,
  },
  link: {
    color: colors.primary,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
  },
  button: {
    marginBottom: spacing.md,
  },
});
