import Constants from "expo-constants";

const DEFAULT_API_URL = "http://localhost:8000";
const BACKEND_PORT = "8000";

/** Same Mac serves both Metro and the Django backend in local dev, so the
 * backend host is derived from Metro's own dev-server host (the LAN IP the
 * phone already used to fetch the JS bundle) rather than a hardcoded IP in
 * .env — this self-corrects whenever DHCP reassigns that IP mid-session,
 * instead of silently hanging on a stale address. Falls back to
 * EXPO_PUBLIC_API_URL (then localhost) when there's no dev-server host,
 * e.g. a production/standalone build. */
export function getApiUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) {
    return `http://${host}:${BACKEND_PORT}`;
  }
  return process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown, message?: string) {
    super(message || `Request failed with status ${status}`);
    this.status = status;
    this.data = data;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Record<string, unknown> | FormData;
  token?: string | null;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, token } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }
  return data as T;
}

/** Builds the {uri, name, type} shape React Native's FormData expects for file fields. */
export function toUploadFile(uri: string, name: string, type = "image/jpeg") {
  return { uri, name, type } as unknown as Blob;
}
