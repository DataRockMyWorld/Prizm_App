import { useAuth } from "@prizm/api";
import { Badge, Card, Screen, ThemedText, spacing } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

// Same wording shown during onboarding — see packages/auth-flow/src/screens/ProfileScreen.tsx.
const TERMS_TEXT =
  "Prism is a platform that connects independent service providers (workers) with customers who need services performed. " +
  "Prism is not an employer of workers and is not a party to the service agreement between a worker and a customer. " +
  "Both parties are responsible for their own conduct, and disputes are handled through Prism's in-app reporting tools.";

function formatAcceptedDate(dateString: string | null): string | null {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function TermsLiabilityScreen() {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();
  const acceptedDate = formatAcceptedDate(profile?.liability_acknowledged_at ?? null);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">Terms &amp; liability</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.statusRow}>
        <Badge
          label={acceptedDate ? `Accepted ${acceptedDate}` : "Not yet accepted"}
          tone={acceptedDate ? "verified" : "neutral"}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Card>
          <ThemedText variant="body">{TERMS_TEXT}</ThemedText>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  headerSpacer: {
    width: 24,
  },
  statusRow: {
    marginBottom: spacing.md,
  },
});
