import { updateProfile, useAuth } from "@prizm/api";
import { Button, Card, ProfileHeader, Screen, ThemedText, spacing } from "@prizm/ui";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { StyleSheet } from "react-native";

export function ProfileScreen() {
  const { accessToken, profile, setProfile, clearSession } = useAuth();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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

  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Profile
      </ThemedText>
      <ProfileHeader
        photo={profile?.photo ?? null}
        fullName={profile?.full_name ?? ""}
        onPickPhoto={pickPhoto}
        onSaveName={saveName}
        isUploadingPhoto={isUploadingPhoto}
      />
      <Card>
        <ThemedText variant="caption">{profile?.phone_number}</ThemedText>
      </Card>
      <Button label="Log out" variant="secondary" onPress={clearSession} style={styles.logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  logout: {
    marginTop: spacing.md,
  },
});
