import type { ServiceCategory } from "@prizm/api";

import { filterCategoriesByQuery } from "./filterCategories";

const CATEGORIES: ServiceCategory[] = [
  { id: 1, name: "Cleaning", slug: "cleaning", estimate_min: "150", estimate_max: "300" },
  { id: 2, name: "Plumbing", slug: "plumbing", estimate_min: "200", estimate_max: "500" },
  { id: 3, name: "Electrical", slug: "electrical", estimate_min: "250", estimate_max: "600" },
  { id: 4, name: "Gardening", slug: "gardening", estimate_min: "150", estimate_max: "350" },
];

test("an empty query returns every category unfiltered", () => {
  expect(filterCategoriesByQuery(CATEGORIES, "")).toEqual(CATEGORIES);
});

test("a whitespace-only query returns every category unfiltered", () => {
  expect(filterCategoriesByQuery(CATEGORIES, "   ")).toEqual(CATEGORIES);
});

test("matches a substring case-insensitively", () => {
  expect(filterCategoriesByQuery(CATEGORIES, "clean").map((c) => c.name)).toEqual(["Cleaning"]);
  expect(filterCategoriesByQuery(CATEGORIES, "ELECTRIC").map((c) => c.name)).toEqual([
    "Electrical",
  ]);
});

test("matches a mid-word substring, not just a prefix", () => {
  expect(filterCategoriesByQuery(CATEGORIES, "umb").map((c) => c.name)).toEqual(["Plumbing"]);
});

test("returns an empty array when nothing matches", () => {
  expect(filterCategoriesByQuery(CATEGORIES, "roofing")).toEqual([]);
});

test("leading/trailing whitespace on the query is trimmed before matching", () => {
  expect(filterCategoriesByQuery(CATEGORIES, "  garden  ").map((c) => c.name)).toEqual([
    "Gardening",
  ]);
});
