import { useAuth } from "@prizm/api";
import { Button, Card, Screen, ThemedText, spacing } from "@prizm/ui";
import React from "react";
import { StyleSheet } from "react-native";

export function ProfileScreen() {
  const { profile, clearSession } = useAuth();

  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Profile
      </ThemedText>
      <Card>
        <ThemedText variant="subtitle">{profile?.full_name || "—"}</ThemedText>
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
