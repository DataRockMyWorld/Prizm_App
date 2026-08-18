import { apiRequest, toUploadFile } from "./client";

export type IdStatus = "not_submitted" | "pending" | "approved" | "rejected";

export interface WorkerProfile {
  categories: number[];
  id_document: string | null;
  id_status: IdStatus;
  id_rejection_reason: string;
  is_online: boolean;
  subscription_status: "free" | "subscribed";
}

export function getWorkerProfile(token: string) {
  return apiRequest<WorkerProfile>("/api/auth/worker-profile/", { token });
}

export function updateWorkerCategories(token: string, categories: number[]) {
  return apiRequest<WorkerProfile>("/api/auth/worker-profile/", {
    method: "PATCH",
    token,
    body: { categories },
  });
}

export function submitIdDocument(token: string, uri: string) {
  const form = new FormData();
  form.append("id_document", toUploadFile(uri, "id_document.jpg"));
  return apiRequest<WorkerProfile>("/api/auth/worker-profile/", {
    method: "PATCH",
    token,
    body: form,
  });
}

export interface Certification {
  id: number;
  category: number;
  document: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string;
  created_at: string;
}

export function listCertifications(token: string) {
  return apiRequest<Certification[]>("/api/auth/certifications/", { token });
}

export function submitCertification(token: string, categoryId: number, uri: string) {
  const form = new FormData();
  form.append("category", String(categoryId));
  form.append("document", toUploadFile(uri, "certificate.jpg"));
  return apiRequest<Certification>("/api/auth/certifications/", {
    method: "POST",
    token,
    body: form,
  });
}

export interface WorkerStatus {
  is_online: boolean;
  id_status: IdStatus;
  subscription_status: "free" | "subscribed";
  last_location_updated_at: string | null;
}

export function getWorkerStatus(token: string) {
  return apiRequest<WorkerStatus>("/api/jobs/worker/status/", { token });
}

export function updateWorkerStatus(
  token: string,
  data: { is_online?: boolean; latitude?: number; longitude?: number }
) {
  return apiRequest<WorkerStatus>("/api/jobs/worker/status/", {
    method: "PATCH",
    token,
    body: data,
  });
}
