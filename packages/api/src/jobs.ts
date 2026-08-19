import { apiRequest, toUploadFile } from "./client";
import type { ServiceCategory } from "./catalog";

export type JobStatus =
  | "requested"
  | "searching"
  | "matched"
  | "accepted"
  | "on_my_way"
  | "arrived"
  | "in_progress"
  | "awaiting_price_confirmation"
  | "completed"
  | "cancelled"
  | "disputed";

export interface JobWorker {
  id: number;
  full_name: string;
  photo: string | null;
  verified: boolean;
  rating_average: number | null;
}

export interface JobRequest {
  id: number;
  category: ServiceCategory;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  photo: string | null;
  status: JobStatus;
  price_range_min: string;
  price_range_max: string;
  agreed_price: string | null;
  worker_note: string;
  worker: JobWorker | null;
  current_offer_responds_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobRequestInput {
  category: number;
  description?: string;
  address?: string;
  latitude: number;
  longitude: number;
  photoUri?: string;
}

export function createJobRequest(token: string, input: CreateJobRequestInput) {
  const form = new FormData();
  form.append("category", String(input.category));
  if (input.description) form.append("description", input.description);
  if (input.address) form.append("address", input.address);
  form.append("latitude", String(input.latitude));
  form.append("longitude", String(input.longitude));
  if (input.photoUri) form.append("photo", toUploadFile(input.photoUri, "job_photo.jpg"));
  return apiRequest<JobRequest>("/api/jobs/", { method: "POST", token, body: form });
}

export function listMyJobs(token: string) {
  return apiRequest<JobRequest[]>("/api/jobs/", { token });
}

export function getJob(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/`, { token });
}

export function cancelJob(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/cancel/`, { method: "POST", token });
}

export function confirmPrice(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/confirm-price/`, { method: "POST", token });
}

export function disputePrice(token: string, jobId: number, details?: string) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/dispute-price/`, {
    method: "POST",
    token,
    body: { details: details || "" },
  });
}

export type ReportCategory = "no_show" | "safety_concern" | "quality_of_work" | "pricing_disagreement";

export function reportJob(token: string, jobId: number, category: ReportCategory, details?: string) {
  return apiRequest<{ id: number; status: string }>(`/api/jobs/${jobId}/report/`, {
    method: "POST",
    token,
    body: { category, details: details || "" },
  });
}

export function rateJob(token: string, jobId: number, stars: number, comment?: string) {
  return apiRequest<void>(`/api/jobs/${jobId}/rate/`, {
    method: "POST",
    token,
    body: { stars, comment: comment || "" },
  });
}
