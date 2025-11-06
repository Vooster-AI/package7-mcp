import { BasicHttpHeaders } from "../constants/basic-http-headers.js";

/**
 * Custom fetch wrapper with browser-like headers to avoid bot detection
 *
 * This utility automatically includes realistic browser headers to prevent
 * requests from being blocked by bot protection systems (e.g., Cloudflare).
 *
 * @param url - The URL to fetch
 * @param options - Optional fetch options (headers will be merged with BasicHttpHeaders)
 * @returns Promise resolving to the Response object
 *
 * @example
 * ```typescript
 * // Simple fetch
 * const response = await fetchWithHeaders("https://example.com/api");
 *
 * // With custom headers (merged with BasicHttpHeaders)
 * const response = await fetchWithHeaders("https://example.com/api", {
 *   headers: { "Authorization": "Bearer token" }
 * });
 *
 * // With other fetch options
 * const response = await fetchWithHeaders("https://example.com/api", {
 *   method: "POST",
 *   body: JSON.stringify({ data: "value" })
 * });
 * ```
 */
export async function fetchWithHeaders(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...BasicHttpHeaders,
      ...(options?.headers || {}),
    },
  };

  return fetch(url, mergedOptions);
}
