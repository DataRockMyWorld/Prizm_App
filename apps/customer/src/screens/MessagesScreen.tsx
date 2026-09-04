import { JobRequest, listMyJobs, useAuth } from "@prizm/api";
import { Avatar, Card, colors, Screen, spacing, ThemedText } from "@prizm/ui";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { isActiveJobStatus } from "../jobsTab/jobsTabGrouping";
import { formatRelativeTime } from "../messages/formatRelativeTime";
import { sortThreadsByRecency } from "../messages/sortThreads";

/** Real inbox — always shows every *active* job with an assigned worker
 * (so there's a predictable way to reach whoever you're currently mid-job
 * with, even before either of you has said anything), plus any completed
 * job that actually has message history (so a finished job with zero
 * conversation doesn't linger here forever). Sorted by most recent
 * activity. Refetches on focus, same as the Jobs tab, since a message can
 * arrive while this tab isn't visible. */
export function MessagesScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const [jobs, setJobs] = useState<JobRequest[] | null>(null);

  const loadThreads = useCallback(async () => {
    if (!accessToken) return;
    try {
      const allJobs = await listMyJobs(accessToken);
      const threads = allJobs.filter(
        (job) => job.worker !== null && (isActiveJobStatus(job.status) || job.last_message !== null)
      );
      setJobs(sortThreadsByRecency(threads));
    } catch {
      setJobs([]);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadThreads();
    }, [loadThreads])
  );

  return (
    <Screen>
      <ThemedText variant="title" style={styles.title}>
        Messages
      </ThemedText>

      {jobs === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : jobs.length === 0 ? (
        <Card>
          <ThemedText variant="subtitle">No messages yet</ThemedText>
          <ThemedText variant="caption">
            Messages will appear here once you're matched with a worker.
          </ThemedText>
        </Card>
      ) : (
        jobs.map((job) => (
          <ThreadRow
            key={job.id}
            job={job}
            onPress={() => navigation.navigate("Chat", { jobId: job.id })}
          />
        ))
      )}
    </Screen>
  );
}

function ThreadRow({ job, onPress }: { job: JobRequest; onPress: () => void }) {
  const preview = job.last_message?.text || "No messages yet — say hello";
  const timestamp = formatRelativeTime(
    job.last_message?.created_at ?? job.updated_at,
    new Date()
  );

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        <Avatar uri={job.worker?.photo ?? null} size={44} />
        <View style={styles.info}>
          <ThemedText variant="subtitle" numberOfLines={1}>
            {job.worker?.full_name || "Your worker"}
          </ThemedText>
          <ThemedText variant="caption" numberOfLines={1} ellipsizeMode="tail">
            {preview}
          </ThemedText>
        </View>
        <ThemedText variant="caption" style={styles.timestamp}>
          {timestamp}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  loading: {
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  timestamp: {
    color: colors.textSecondary,
  },
});
