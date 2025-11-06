export type Category =
  | "blog"
  | "codes"
  | "guides"
  | "resources"
  | "reference"
  | "sdk"
  | "legacy"
  | "unknown";

export const categories: Category[] = [
  "blog",
  "codes",
  "guides",
  "resources",
  "reference",
  "sdk",
  "legacy",
  "unknown",
] as const;

const set = new Set<string>(categories);

export function isCategory(value: string): value is Category {
  return set.has(value);
}

/**
 * Weight configuration by category
 * 1.0 = default, 0.5 = 50% decrease, 1.2 = 20% increase
 */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  guides: 1.2, // Increase priority for guide documents
  reference: 1.0, // Reference document default
  sdk: 1.0, // SDK document default (same as reference)
  resources: 0.8, // Slightly decrease resource documents
  blog: 0.7, // Decrease blog posts
  codes: 0.5, // Significantly decrease error codes/vendor/enum information
  legacy: 0.4, // Significantly decrease legacy documents
  unknown: 1.0,
} as const;
