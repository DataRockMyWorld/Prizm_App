import { Ionicons } from "@expo/vector-icons";
import { JobRequest, getJob, rateJob, useAuth } from "@prizm/api";
import { Avatar, Button, Screen, TextField, ThemedText, colors, spacing } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "Rating">;

export function RatingScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;
  const [job, setJob] = useState<JobRequest | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getJob(accessToken, jobId)
      .then(setJob)
      .catch(() => {});
  }, [accessToken, jobId]);

  const handleSubmit = async () => {
    if (!accessToken || stars === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await rateJob(accessToken, jobId, stars, comment.trim());
      navigation.popToTop();
    } catch {
      setError("Couldn't submit your rating. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Avatar uri={job.worker?.photo} size={64} />
        <ThemedText variant="subtitle" style={styles.centered}>
          Rate {job.worker?.full_name || "your worker"}
        </ThemedText>
        <ThemedText variant="caption" style={styles.centered}>
          How was your {job.category.name.toLowerCase()} job?
        </ThemedText>

        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable key={value} onPress={() => setStars(value)} hitSlop={12}>
              <Ionicons
                name={value <= stars ? "star" : "star-outline"}
                size={34}
                // colors.border (#ECE7E2) against colors.pageBackground
                // (#F1ECE7) is nearly indistinguishable — same contrast bug
                // already fixed once for PinDots' empty-dot outline.
                // colors.textSecondary matches that established fix.
                color={value <= stars ? colors.gold : colors.textSecondary}
              />
            </Pressable>
          ))}
        </View>

        <TextField
          placeholder="Add a comment (optional)"
          value={comment}
          onChangeText={setComment}
          multiline
          style={styles.commentField}
        />

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        <View style={styles.spacer} />
        <Button
          label="Submit Rating"
          onPress={handleSubmit}
          disabled={stars === 0}
          loading={isSubmitting}
        />
        <Pressable onPress={() => navigation.popToTop()}>
          <ThemedText variant="body" style={styles.skip}>
            Skip
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.xl,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  centered: {
    textAlign: "center",
  },
  starRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  commentField: {
    width: "100%",
    minHeight: 70,
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
  },
  error: {
    color: colors.danger,
  },
  spacer: {
    flex: 1,
  },
  skip: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textSecondary,
  },
});
