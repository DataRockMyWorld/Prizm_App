import { apiRequest, toUploadFile } from "./client";
import type { ServiceCategory } from "./catalog";

export type JobStatus =
  | "requested"
  | "searching"
  | "matched"
  | "accepted"
  | "arrived"
  | "quote_pending"
  | "quote_accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "declined"
  | "disputed";

export interface JobWorker {
  id: number;
  full_name: string;
  photo: string | null;
  verified: boolean;
  rating_average: number | null;
  jobs_completed: number;
}

export interface JobCustomer {
  id: number;
  full_name: string;
  photo: string | null;
}

export interface JobRating {
  stars: number;
  comment: string;
}

export interface JobLastMessage {
  text: string;
  created_at: string;
  sender_id: number;
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
  customer: JobCustomer | null;
  worker: JobWorker | null;
  current_offer_responds_by: string | null;
  accepted_at: string | null;
  arrived_at: string | null;
  quoted_at: string | null;
  quote_accepted_at: string | null;
  started_at: string | null;
  rating: JobRating | null;
  last_message: JobLastMessage | null;
  /** Human-readable reason for a worker's on-site decline — null unless
   * `status === "declined"`. */
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobOffer {
  id: number;
  job: JobRequest;
  offered_at: string;
  responds_by: string;
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

/** Active jobs only, filtered server-side — in practice always a small
 * working set, so this stays a plain unpaginated array (unlike
 * completed history, which has no natural upper bound — see
 * listCompletedJobsPage). */
export function listActiveJobs(token: string) {
  return apiRequest<JobRequest[]>("/api/jobs/?status_group=active", { token });
}

export interface PaginatedJobs {
  count: number;
  next: string | null;
  previous: string | null;
  results: JobRequest[];
}

/** Completed/cancelled/disputed jobs, paginated — a customer or worker's
 * terminal-job history grows for as long as they use the app, so the
 * Jobs tab's Completed segment loads this a page at a time (infinite
 * scroll) instead of the whole history at once. `page` is 1-indexed,
 * matching DRF's PageNumberPagination. */
export function listCompletedJobsPage(token: string, page: number, pageSize = 20) {
  return apiRequest<PaginatedJobs>(
    `/api/jobs/?status_group=completed&page=${page}&page_size=${pageSize}`,
    { token }
  );
}

export function getJob(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/`, { token });
}

export function cancelJob(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/cancel/`, { method: "POST", token });
}

export type CancellationReason =
  | "personal_emergency"
  | "transport_issue"
  | "job_details_unclear"
  | "other";

/** Worker-side cancel, distinct from the customer's reason-less `cancelJob`. */
export function cancelJobAsWorker(
  token: string,
  jobId: number,
  reason: CancellationReason,
  note?: string
) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/cancel/`, {
    method: "POST",
    token,
    body: { reason, note: note || "" },
  });
}

export function getIncomingOffers(token: string) {
  return apiRequest<JobOffer[]>("/api/jobs/worker/incoming/", { token });
}

export function acceptOffer(token: string, offerId: number) {
  return apiRequest<JobRequest>(`/api/jobs/offers/${offerId}/accept/`, {
    method: "POST",
    token,
  });
}

export function declineOffer(token: string, offerId: number) {
  return apiRequest<{ detail: string }>(`/api/jobs/offers/${offerId}/decline/`, {
    method: "POST",
    token,
  });
}

export function markArrived(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/arrived/`, { method: "POST", token });
}

/** Worker's on-site quote — amount + optional "what's included" note. Sets the
 *  price before any work; valid from `arrived` or (overwrite) `quote_pending`. */
export function submitQuote(
  token: string,
  jobId: number,
  agreedPrice: number,
  note?: string
) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/quote/`, {
    method: "POST",
    token,
    body: { agreed_price: agreedPrice, note: note || "" },
  });
}

/** Worker declines the job after arriving and evaluating it (terminal). */
export function declineJob(
  token: string,
  jobId: number,
  reason: CancellationReason,
  note?: string
) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/decline/`, {
    method: "POST",
    token,
    body: { reason, note: note || "" },
  });
}

export function markInProgress(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/start/`, { method: "POST", token });
}

/** Worker marks the job done. No price step — it was agreed at the quote. */
export function completeJob(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/complete/`, { method: "POST", token });
}

/** Customer confirms the worker's on-site quote — unlocks "Start work". */
export function confirmQuote(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/confirm-quote/`, { method: "POST", token });
}

/** Customer rejects the quote — closes the job (they can re-request). */
export function rejectQuote(token: string, jobId: number) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/reject-quote/`, { method: "POST", token });
}

/** Customer disputes the agreed price after completion → manual admin review. */
export function disputePrice(token: string, jobId: number, details?: string) {
  return apiRequest<JobRequest>(`/api/jobs/${jobId}/dispute-price/`, {
    method: "POST",
    token,
    body: { details: details || "" },
  });
}

export type ReportCategory =
  | "no_show"
  | "safety_concern"
  | "quality_of_work"
  | "pricing_disagreement"
  | "harassment"
  | "inappropriate_content"
  | "spam"
  | "other";

/** `messageId` scopes the report to one specific chat message rather than
 * the other party generally — omit it for a general report (see
 * docs/prds/chat-safety.md). Backend scopes/validates it against `jobId`. */
export function reportJob(
  token: string,
  jobId: number,
  category: ReportCategory,
  details?: string,
  messageId?: number
) {
  return apiRequest<{ id: number; status: string }>(`/api/jobs/${jobId}/report/`, {
    method: "POST",
    token,
    body: { category, details: details || "", message_id: messageId },
  });
}

/** Blocks the other party of `jobId`, account-wide — only succeeds once
 * that job is terminal (completed/cancelled/disputed); see
 * docs/prds/chat-safety.md. */
export function blockCounterpart(token: string, jobId: number) {
  return apiRequest<void>(`/api/jobs/${jobId}/block/`, { method: "POST", token });
}

export function rateJob(token: string, jobId: number, stars: number, comment?: string) {
  return apiRequest<void>(`/api/jobs/${jobId}/rate/`, {
    method: "POST",
    token,
    body: { stars, comment: comment || "" },
  });
}
