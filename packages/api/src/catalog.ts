import { apiRequest } from "./client";

export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  estimate_min: string;
  estimate_max: string;
}

export function listCategories(token: string) {
  return apiRequest<ServiceCategory[]>("/api/services/categories/", { token });
}
