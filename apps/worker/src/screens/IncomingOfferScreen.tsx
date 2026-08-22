import { acceptOffer, ApiError, declineOffer, useAuth } from "@prizm/api";
import { Button, colors, radii, spacing, ThemedText } from "@prizm/ui";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { useOfferPolling } from "../offers/OfferPollingProvider";
import { computeRemainingSeconds, formatCountdown } from "../offers/offerTiming";

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "detail" in error.data) {
    return String((error.data as { detail: unknown }).detail);
  }
  return fallback;
}

/** W1 — full-screen interrupt for a new broadcast job offer, with a live
 * countdown to the offer's server-side expiry. */
export function IncomingOfferScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const { currentOffer, dismiss } = useOfferPolling();
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    currentOffer ? computeRemainingSeconds(currentOffer.responds_by) : 0
  );
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    if (!currentOffer) return undefined;
    const tick = () => setRemainingSeconds(computeRemainingSeconds(currentOffer.responds_by));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentOffer]);

  useEffect(() => {
    if (currentOffer && remainingSeconds === 0) {
      dismiss();
      navigation.goBack();
    }
    // Only re-run when the countdown actually hits zero, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds === 0]);

  if (!currentOffer || !accessToken) {
    return null;
  }
  const job = currentOffer.job;

  const handleDecline = async () => {
    setIsResponding(true);
    try {
      await declineOffer(accessToken, currentOffer.id);
    } catch (error) {
      Alert.alert("Couldn't decline", apiErrorMessage(error, "Something went wrong."));
    } finally {
      setIsResponding(false);
      dismiss();
      navigation.goBack();
    }
  };

  const handleAccept = async () => {
    setIsResponding(true);
    try {
      await acceptOffer(accessToken, currentOffer.id);
      dismiss();
      // TODO(T4): once the active-job screen exists, navigate there with
      // this job instead of just returning to Home.
      navigation.navigate("Tabs");
    } catch (error) {
      Alert.alert("Couldn't accept", apiErrorMessage(error, "This offer may have expired."));
      setIsResponding(false);
      dismiss();
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText variant="title" style={styles.title}>
          New job request
        </ThemedText>
        <ThemedText variant="caption" style={styles.countdown}>
          Respond within {formatCountdown(remainingSeconds)}
        </ThemedText>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.categoryRow}>
          <View style={styles.categoryIcon} />
          <ThemedText variant="subtitle" style={styles.categoryName}>
            {job.category.name}
          </ThemedText>
        </View>
        {!!job.description && (
          <ThemedText variant="body" style={styles.description}>
            {job.description}
          </ThemedText>
        )}
        {!!job.address && <ThemedText variant="caption">{job.address}</ThemedText>}
      </View>

      <View style={styles.estimateBanner}>
        <ThemedText style={styles.estimateText}>
          Est. N${job.price_range_min}–{job.price_range_max} · final price is agreed with the
          customer
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Button
          label="Decline"
          variant="secondary"
          onPress={handleDecline}
          disabled={isResponding}
          style={styles.actionButton}
        />
        <Button
          label="Accept"
          variant="primary"
          onPress={handleAccept}
          disabled={isResponding}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  title: {
    textAlign: "center",
  },
  countdown: {
    color: colors.primary,
    fontWeight: "800",
  },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  categoryName: {
    flex: 1,
  },
  description: {
    marginTop: spacing.xs,
  },
  estimateBanner: {
    backgroundColor: "#FFF3EA",
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  estimateText: {
    color: "#9A5A2A",
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: "auto",
  },
  actionButton: {
    flex: 1,
  },
});
