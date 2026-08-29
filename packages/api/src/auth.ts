import { ApiError, apiRequest, toUploadFile } from "./client";

export type Role = "customer" | "worker";

export interface AuthTokens {
  access: string;
  refresh: string;
}

export function requestOtp(phoneNumber: string) {
  return apiRequest<{ detail: string }>("/api/auth/otp/request/", {
    method: "POST",
    body: { phone_number: phoneNumber },
  });
}

export function verifyOtp(phoneNumber: string, code: string) {
  return apiRequest<{ otp_token: string; is_new_user: boolean }>("/api/auth/otp/verify/", {
    method: "POST",
    body: { phone_number: phoneNumber, code },
  });
}

export function register(otpToken: string, role: Role, pin: string) {
  return apiRequest<AuthTokens>("/api/auth/register/", {
    method: "POST",
    body: { otp_token: otpToken, role, pin },
  });
}

export function login(phoneNumber: string, pin: string) {
  return apiRequest<AuthTokens>("/api/auth/login/", {
    method: "POST",
    body: { phone_number: phoneNumber, password: pin },
  });
}

export function refreshAccessToken(refresh: string) {
  return apiRequest<{ access: string }>("/api/auth/login/refresh/", {
    method: "POST",
    body: { refresh },
  });
}

/** Actually revokes the refresh token server-side (blacklists it) instead of
 * just discarding it client-side — see AuthContext.clearSession. */
export function logout(token: string, refresh: string) {
  return apiRequest<void>("/api/auth/logout/", {
    method: "POST",
    token,
    body: { refresh },
  });
}

const DELETE_ACCOUNT_FALLBACK_MESSAGE = "Couldn't delete your account. Please try again.";

/** Anonymizes the account server-side (see backend DeleteAccountView) —
 * blocked with a 400 while a job is still active; the caller should surface
 * `getDeleteAccountErrorMessage(err)` rather than a generic failure message,
 * since the guard-rail's explanation is the whole point of a 400 here. */
export function deleteAccount(token: string) {
  return apiRequest<void>("/api/auth/delete-account/", { method: "POST", token });
}

/** Pulls the backend's actual explanation (e.g. "Finish or cancel your
 * active job before deleting your account.") out of a failed
 * `deleteAccount` call, falling back to a generic message for anything
 * that isn't a well-formed 400 from that endpoint (network error, etc.). */
export function getDeleteAccountErrorMessage(err: unknown): string {
  if (err instanceof ApiError && typeof (err.data as { detail?: unknown })?.detail === "string") {
    return (err.data as { detail: string }).detail;
  }
  return DELETE_ACCOUNT_FALLBACK_MESSAGE;
}

export interface Profile {
  phone_number: string;
  role: Role;
  full_name: string;
  photo: string | null;
  liability_acknowledged_at: string | null;
  date_joined: string;
}

export function getProfile(token: string) {
  return apiRequest<Profile>("/api/auth/profile/", { token });
}

export interface ProfileUpdate {
  full_name?: string;
  liability_acknowledged?: boolean;
  photoUri?: string;
}

export function updateProfile(token: string, data: ProfileUpdate) {
  const { photoUri, ...fields } = data;
  if (!photoUri) {
    return apiRequest<Profile>("/api/auth/profile/", { method: "PATCH", token, body: fields });
  }
  const form = new FormData();
  if (fields.full_name !== undefined) form.append("full_name", fields.full_name);
  if (fields.liability_acknowledged !== undefined)
    form.append("liability_acknowledged", String(fields.liability_acknowledged));
  form.append("photo", toUploadFile(photoUri, "photo.jpg"));
  return apiRequest<Profile>("/api/auth/profile/", { method: "PATCH", token, body: form });
}
