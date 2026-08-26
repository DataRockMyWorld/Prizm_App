import { apiRequest } from "./client";

export type DevicePlatform = "ios" | "android";

export function registerDevice(token: string, expoPushToken: string, platform: DevicePlatform) {
  return apiRequest<void>("/api/notifications/register-device/", {
    method: "POST",
    token,
    body: { token: expoPushToken, platform },
  });
}

export function unregisterDevice(token: string, expoPushToken: string) {
  return apiRequest<void>("/api/notifications/register-device/", {
    method: "DELETE",
    token,
    body: { token: expoPushToken },
  });
}

export interface NotificationRoute {
  screen: "JobStatus" | "Chat";
  jobId: number;
}

/** Maps a push notification's data payload to where to navigate on tap.
 * `job_offer` deliberately returns null — per the push-notifications PRD,
 * tapping it just needs to foreground the app; the existing worker-side
 * offer-poll hook picks the offer up on its own, no explicit navigation
 * needed. An unrecognized `type` also returns null rather than throwing —
 * a defensive fallback for a payload shape this client doesn't know about
 * yet (e.g. a newer server version), not a case worth crashing over. */
export function getNotificationRoute(data: { type: string; job_id: number }): NotificationRoute | null {
  switch (data.type) {
    case "job_accepted":
      return { screen: "JobStatus", jobId: data.job_id };
    case "chat_message":
      return { screen: "Chat", jobId: data.job_id };
    default:
      return null;
  }
}
