import { getWorkerStatus, useAuth, WorkerStatus } from "@prizm/api";
import { Badge, Button, Card, Screen, ThemedText, spacing } from "@prizm/ui";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const ID_STATUS_LABEL: Record<string, string> = {
  not_submitted: "Not submitted",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function ProfileScreen() {
  const { accessToken, profile, clearSession } = useAuth();
  const [status, setStatus] = useState<WorkerStatus | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getWorkerStatus(accessToken)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [accessToken]);

  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Profile
      </ThemedText>
      <Card>
        <ThemedText variant="subtitle">{profile?.full_name || "—"}</ThemedText>
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
