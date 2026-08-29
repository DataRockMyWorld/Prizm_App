import type { Role } from "@prizm/api";

export interface NameFieldCopy {
  label: string | null;
  placeholder: string;
}

/** The Basic Profile screen's name field reads differently per role — a
 * worker's name should match their ID (it's what gets checked against the
 * document they upload next), while a customer's is just a display name. */
export function getNameFieldCopy(role: Role): NameFieldCopy {
  if (role === "worker") {
    return {
      label: "Full name (as it appears on your ID)",
      placeholder: "e.g. Jane M. Nghidinwa",
    };
  }
  return { label: null, placeholder: "Full name" };
}
