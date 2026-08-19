import { cancelJob, getJob, useAuth } from "@prizm/api";
import { Button, Screen, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "Searching">;

export function SearchingScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;
  const [isCancelling, setIsCancelling] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(async () => {
      try {
        const job = await getJob(accessToken, jobId);
        if (navigatedRef.current) return;
        if (job.status === "matched" || job.status === "accepted") {
          navigatedRef.current = true;
          navigation.replace("Matched", { jobId });
        } else if (job.status === "cancelled") {
          navigatedRef.current = true;
          navigation.popToTop();
        }
      } catch {
        // transient poll failure — try again next tick
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [accessToken, jobId, navigation]);

  const handleCancel = async () => {
    if (!accessToken) return;
    setIsCancelling(true);
    try {
      await cancelJob(accessToken, jobId);
      navigation.popToTop();
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.spinner} />
        <ThemedText variant="title" style={styles.centered}>
          Looking for a trusted professional near you...
        </ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.subtitle]}>
          Matching you with the nearest available worker — Verified & Certified pros get priority
        </ThemedText>
        <Button
          label="Cancel Request"
          variant="secondary"
          onPress={handleCancel}
          loading={isCancelling}
          style={styles.cancelButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  spinner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: "#FFE6D3",
    borderTopColor: colors.primary,
  },
  centered: {
    textAlign: "center",
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
  cancelButton: {
    width: "100%",
  },
});
