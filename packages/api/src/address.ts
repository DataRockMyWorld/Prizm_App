import { apiRequest } from "./client";

export interface Address {
  id: number;
  label: string;
  address_text: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export type AddressInput = {
  label: string;
  address_text: string;
  latitude: number;
  longitude: number;
};

export function listAddresses(token: string) {
  return apiRequest<Address[]>("/api/auth/addresses/", { token });
}

export function createAddress(token: string, data: AddressInput) {
  return apiRequest<Address>("/api/auth/addresses/", {
    method: "POST",
    token,
    body: data,
  });
}

export function updateAddress(token: string, id: number, data: Partial<AddressInput>) {
  return apiRequest<Address>(`/api/auth/addresses/${id}/`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export function deleteAddress(token: string, id: number) {
  return apiRequest<null>(`/api/auth/addresses/${id}/`, {
    method: "DELETE",
    token,
  });
}
