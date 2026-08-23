import { getWorkerStatus, updateProfile, useAuth, WorkerStatus } from "@prizm/api";
import { Badge, Button, Card, ProfileHeader, Screen, ThemedText, spacing } from "@prizm/ui";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const ID_STATUS_LABEL: Record<string, string> = {
  not_submitted: "Not submitted",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function ProfileScreen() {
  const { accessToken, profile, setProfile, clearSession } = useAuth();
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getWorkerStatus(accessToken)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [accessToken]);

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
        <View style={styles.row}>
          <ThemedText variant="body">ID verification</ThemedText>
          <Badge
            label={ID_STATUS_LABEL[status?.id_status ?? "not_submitted"]}
            tone={status?.id_status === "approved" ? "verified" : "neutral"}
          />
        </View>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  logout: {
    marginTop: spacing.md,
  },
});
