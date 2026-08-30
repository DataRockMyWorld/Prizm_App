import type { ServiceCategory } from "@prizm/api";

/** Live client-side filter for the Home screen's search bar — case-
 * insensitive substring match on category name. No backend call: the
 * category list is small and already fully fetched (see chat with user,
 * 2026-08-30 — a client-side filter was chosen deliberately over a
 * results screen or a backend search endpoint, since the catalog is a
 * handful of static categories, not a large/growing dataset). An empty
 * (or whitespace-only) query returns every category unfiltered. */
export function filterCategoriesByQuery(
  categories: ServiceCategory[],
  query: string
): ServiceCategory[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return categories;
  return categories.filter((category) => category.name.toLowerCase().includes(normalized));
}
