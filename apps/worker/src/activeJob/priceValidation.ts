/** Parses a proposed-price input string, returning the numeric amount if
 * it's a valid positive number, or null otherwise (empty, zero, negative,
 * or non-numeric) — stricter than the backend, which allows 0. */
export function validatePriceAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
