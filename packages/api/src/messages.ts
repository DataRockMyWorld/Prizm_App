import { apiRequest } from "./client";

export interface MessageSender {
  id: number;
  full_name: string;
  photo: string | null;
}

export interface Message {
  id: number;
  sender: MessageSender;
  text: string;
  created_at: string;
}

export function listMessages(token: string, jobId: number) {
  return apiRequest<Message[]>(`/api/jobs/${jobId}/messages/`, { token });
}

export function sendMessage(token: string, jobId: number, text: string) {
  return apiRequest<Message>(`/api/jobs/${jobId}/messages/`, {
    method: "POST",
    token,
    body: { text },
  });
}
