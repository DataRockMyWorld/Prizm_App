const DEFAULT_API_URL = "http://localhost:8000";

/** Override with EXPO_PUBLIC_API_URL in each app's .env (e.g. for an Android
 * emulator use http://10.0.2.2:8000, for a physical device use your Mac's
 * LAN IP). */
export function getApiUrl(): string {
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
