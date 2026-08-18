import { apiRequest, toUploadFile } from "./client";

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

export interface Profile {
  phone_number: string;
  role: Role;
  full_name: string;
  photo: string | null;
  liability_acknowledged_at: string | null;
  biometric_enabled: boolean;
}

export function getProfile(token: string) {
  return apiRequest<Profile>("/api/auth/profile/", { token });
}

export interface ProfileUpdate {
  full_name?: string;
  liability_acknowledged?: boolean;
  biometric_enabled?: boolean;
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
  if (fields.biometric_enabled !== undefined)
    form.append("biometric_enabled", String(fields.biometric_enabled));
  form.append("photo", toUploadFile(photoUri, "photo.jpg"));
  return apiRequest<Profile>("/api/auth/profile/", { method: "PATCH", token, body: form });
}
