/**
 * URL resolution utilities for handling absolute and relative URLs
 *
 * These utilities follow pure function principles for testability and
 * are designed to handle the common patterns found in llms.txt files:
 * - Absolute URLs (https://example.com/path)
 * - Root-relative URLs (/docs/api)
 * - Path-relative URLs (api/endpoint)
 *
 * All functions are side-effect free and deterministic.
 */

const VALID_PROTOCOLS = ["http:", "https:"] as const;

/**
 * Checks if a URL is absolute (starts with http:// or https://)
 *
 * An absolute URL is one that can be used independently without a base URL.
 * This function validates both the structure and protocol of the URL.
 *
 * @param url - The URL string to check
 * @returns true if the URL is absolute and valid, false otherwise
 *
 * @example
 * ```typescript
 * isAbsoluteUrl("https://example.com") // true
 * isAbsoluteUrl("http://localhost:3000/path") // true
 * isAbsoluteUrl("/relative/path") // false
 * isAbsoluteUrl("path/to/file") // false
 * isAbsoluteUrl("") // false
 * ```
 */
export function isAbsoluteUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  // Try to parse as URL - if it succeeds and has http/https protocol, it's absolute
  try {
    const parsed = new URL(url);
    return VALID_PROTOCOLS.includes(parsed.protocol as typeof VALID_PROTOCOLS[number]);
  } catch {
    return false;
  }
}

/**
 * Extracts the base URL (protocol + host + port) from a full URL
 *
 * The base URL consists of the protocol, hostname, and port (if specified).
 * This is useful for resolving relative URLs against a base domain.
 *
 * @param url - The full URL string (must be absolute)
 * @returns The base URL without path, query, or fragment
 * @throws {TypeError} If the URL is invalid or relative
 *
 * @example
 * ```typescript
 * extractBaseUrl("https://example.com/path/to/file") // "https://example.com"
 * extractBaseUrl("https://example.com:8080/path") // "https://example.com:8080"
 * extractBaseUrl("https://api.supabase.com/v1/auth") // "https://api.supabase.com"
 * extractBaseUrl("/relative/path") // throws TypeError
 * ```
 */
export function extractBaseUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

/**
 * Resolves a potentially relative URL against a base URL
 *
 * This function handles three types of URLs:
 * 1. Absolute URLs - returned unchanged
 * 2. Root-relative URLs (/path) - resolved against base domain
 * 3. Path-relative URLs (path) - resolved against base URL with path
 *
 * Uses the standard URL API for proper resolution including:
 * - Parent directory navigation (..)
 * - Current directory (.)
 * - Query strings and fragments
 *
 * @param url - The URL to resolve (can be absolute or relative)
 * @param baseUrl - The base URL to resolve against (must be absolute)
 * @returns The resolved absolute URL with normalized path
 * @throws {Error} If baseUrl is invalid or resolution fails
 *
 * @example
 * ```typescript
 * // Absolute URLs pass through
 * resolveUrl("https://other.com", "https://example.com") // "https://other.com"
 *
 * // Root-relative URLs
 * resolveUrl("/docs/api", "https://example.com") // "https://example.com/docs/api"
 * resolveUrl("/docs/api", "https://example.com/some/path") // "https://example.com/docs/api"
 *
 * // Path-relative URLs
 * resolveUrl("api/endpoint", "https://example.com/docs/") // "https://example.com/docs/api/endpoint"
 * resolveUrl("../api", "https://example.com/docs/") // "https://example.com/api"
 *
 * // Real-world examples
 * resolveUrl("/providers/openai", "https://ai-sdk.dev/llms.txt") // "https://ai-sdk.dev/providers/openai"
 * ```
 */
export function resolveUrl(url: string, baseUrl: string): string {
  // If already absolute, return as-is
  if (isAbsoluteUrl(url)) {
    return url;
  }

  // If empty, return base URL
  if (!url || url.trim() === "") {
    return baseUrl;
  }

  // Use URL constructor to resolve relative paths
  // This handles /, ./, ../, etc. automatically per RFC 3986
  try {
    const resolved = new URL(url, baseUrl);
    return resolved.href;
  } catch (error) {
    // If resolution fails, provide detailed error message
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to resolve URL: "${url}" against base: "${baseUrl}". ${errorMessage}`
    );
  }
}
