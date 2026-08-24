import { apiRequest } from "./client";

export interface CustomerProfileStats {
  requests_completed: number;
}

export function getCustomerProfileStats(token: string) {
  return apiRequest<CustomerProfileStats>("/api/auth/customer-profile/", { token });
}
