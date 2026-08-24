import { submitIdDocument, useAuth } from "@prizm/api";
import { Button, fontFamily, ProgressBar, Screen, ThemedText, UploadTile, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { WorkerOnboardingStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerOnboardingStackParamList, "IdUpload">;

export function IdUploadScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [documentUri, setDocumentUri] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickDocument = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) {
      setDocumentUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!documentUri || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitIdDocument(accessToken, documentUri);
      navigation.navigate("Certifications");
    } catch {
      setError("Couldn't upload your ID. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="caption" style={styles.step}>
          STEP 1 OF 2
        </ThemedText>
        <ProgressBar progress={0.5} />
        <ThemedText variant="title">Unlock your earning potential</ThemedText>
        <ThemedText variant="body" style={styles.subtitle}>
          Verify your identity to start accepting paid jobs
        </ThemedText>
        <UploadTile label="ID document" uri={documentUri} onPress={pickDocument} />
        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        <View style={styles.spacer} />
        <Button
          label="Submit for Review"
          onPress={handleSubmit}
          disabled={!documentUri}
          loading={isSubmitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  step: {
    color: "#FF6C22",
    fontFamily: fontFamily.extraBold,
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: -spacing.sm,
  },
  error: {
    color: colors.danger,
  },
  spacer: {
    flex: 1,
  },
});
