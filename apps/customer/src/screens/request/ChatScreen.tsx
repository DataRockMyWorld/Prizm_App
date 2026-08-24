import { getJob, JobRequest, sendMessage, useAuth } from "@prizm/api";
import { Avatar, Button, colors, radii, Screen, spacing, TextField, ThemedText } from "@prizm/ui";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useMessagePolling } from "../../request/useMessagePolling";
import type { RequestStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RequestStackParamList, "Chat">;

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "disputed"]);

/** Per-job chat, reached from JobStatusScreen's chat icon. Fetches the job
 * once on mount (for the worker's identity in the header and the
 * terminal-status gate — not re-fetched on every message-poll tick; a job
 * closing mid-chat-session without this screen noticing is an accepted
 * edge case, see chat PRD). "Mine" vs "theirs" is decided by comparing a
 * message's sender id to job.customer.id, not a separately-fetched own-user
 * id — the customer viewing this screen is always job.customer. */
export function ChatScreen({ navigation, route }: Props) {
  const { accessToken } = useAuth();
  const { jobId } = route.params;

  const [job, setJob] = useState<JobRequest | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { messages, refresh } = useMessagePolling({ accessToken, jobId });

  useEffect(() => {
    if (!accessToken) return;
    getJob(accessToken, jobId)
      .then(setJob)
      .catch(() => {});
  }, [accessToken, jobId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !accessToken || isSending) return;
    setIsSending(true);
    try {
      await sendMessage(accessToken, jobId, text);
      setDraft("");
      await refresh();
    } catch {
      // leave the draft in place so the customer can retry
    } finally {
      setIsSending(false);
    }
  };

  if (!job) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const myUserId = job.customer?.id;
  const isClosed = TERMINAL_STATUSES.has(job.status);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ThemedText variant="title">‹</ThemedText>
        </Pressable>
        <Avatar uri={job.worker?.photo ?? null} size={32} />
        <ThemedText variant="subtitle" style={styles.headerName}>
          {job.worker?.full_name || "Your worker"}
        </ThemedText>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && (
          <ThemedText variant="caption" style={styles.emptyState}>
            No messages yet — say hello.
          </ThemedText>
        )}
        {messages.map((message) => {
          const isMine = message.sender.id === myUserId;
          return (
            <View
              key={message.id}
              style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
            >
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <ThemedText variant="body" style={isMine ? styles.bubbleTextMine : undefined}>
                  {message.text}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {isClosed ? (
        <ThemedText variant="caption" style={styles.closedNote}>
          This job is closed.
        </ThemedText>
      ) : (
        <View style={styles.inputRow}>
          <TextField
            placeholder="Type a message"
            value={draft}
            onChangeText={setDraft}
            containerStyle={styles.inputField}
            multiline
          />
          <Button label="Send" onPress={handleSend} disabled={!draft.trim()} loading={isSending} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerName: {
    flex: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: spacing.sm,
  },
  emptyState: {
    textAlign: "center",
    marginTop: spacing.lg,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubbleRowTheirs: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceMuted,
  },
  bubbleTextMine: {
    color: colors.textInverse,
  },
  closedNote: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  inputField: {
    flex: 1,
  },
});
