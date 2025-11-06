import { categories, Category } from "../constants/category.js";
import { RawDocs } from "./types.js";
import { resolveUrl, extractBaseUrl } from "./url-utils.js";

/**
 * Parses llms.txt content into RawDocs array
 * Supports multiple formats:
 * - Markdown links: [title](url): description
 * - Plain URLs with optional description
 * - Relative URLs (resolved against llmsTxtUrl if provided)
 * - TossPayments-specific versioning and categories (backward compatible)
 *
 * @param text - The llms.txt content
 * @param libraryId - Optional library identifier for library-specific parsing
 * @param llmsTxtUrl - Optional URL of the llms.txt file for resolving relative URLs
 * @returns Array of parsed documents
 */
export function parseLLMText(
  text: string,
  libraryId?: string,
  llmsTxtUrl?: string
): RawDocs[] {
  // Extract base URL once for efficiency
  const baseUrl = llmsTxtUrl ? extractBaseUrl(llmsTxtUrl) : undefined;

  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .filter((line) => {
      // Skip comment lines
      if (line.trim().startsWith("#") || line.trim().startsWith("//")) {
        return false;
      }
      // Must contain a URL (absolute or relative)
      return /https?:\/\/[^\s]+/.test(line) || /\/[^\s]+/.test(line);
    })
    .map((line) => {
      const link = extractLink(line);
      return parse({ text: line, link, libraryId, baseUrl });
    })
    .filter((doc) => doc !== null) as RawDocs[];
}

/**
 * Extracts URL from a line
 * Supports markdown links [text](url) or plain URLs
 */
function extractLink(line: string): string {
  // Try markdown link format first
  const markdownMatch = line.match(/\]\(([^)]+)\)/);
  if (markdownMatch) {
    return markdownMatch[1].trim();
  }

  // Try plain URL
  const urlMatch = line.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    return urlMatch[0].trim();
  }

  return "";
}

function parseVersionFromUrl(url: string): "v1" | "v2" | undefined {
  if (existsVersion(url)) {
    return extractVersion(url);
  }

  if (["sdk", "guides"].some((keyword) => url.includes(keyword))) {
    return "v1";
  }

  return;
}

function parseVersionFromTitle(title: string): "v1" | "v2" | undefined {
  title = title.toLowerCase();

  if (title.includes("version 1")) {
    return "v1";
  } else if (title.includes("version 2")) {
    return "v2";
  }

  return;
}

/**
 * Parses a single line into RawDocs format
 * Handles both markdown and plain text formats
 * Resolves relative URLs if baseUrl is provided
 */
function parse(link: {
  text: string;
  link: string;
  libraryId?: string;
  baseUrl?: string;
}): RawDocs | null {
  const { text, link: url, baseUrl } = link;

  if (!url) {
    return null;
  }

  try {
    // Resolve relative URLs if baseUrl is provided
    const resolvedUrl = baseUrl ? resolveUrl(url, baseUrl) : url;

    const title = extractTitle(text, resolvedUrl);
    const description = extractDescription(text, resolvedUrl);
    const version =
      parseVersionFromUrl(resolvedUrl) ?? parseVersionFromTitle(title);
    const category = extractCategory(resolvedUrl);

    return {
      text,
      title,
      link: resolvedUrl,
      version,
      description,
      category,
    };
  } catch (error) {
    // Log warning but don't fail - return minimal valid document
    console.warn(`Failed to parse line: ${text}`, error);
    return null;
  }
}

/**
 * Extracts title from markdown link or uses URL as fallback
 */
function extractTitle(text: string, fallbackUrl: string): string {
  // Try markdown format: [title](url)
  const markdownMatch = text.match(/\[([^\]]+)\]/);
  if (markdownMatch && markdownMatch[1].trim()) {
    return markdownMatch[1].trim();
  }

  // Fallback: use URL path as title
  try {
    const url = new URL(fallbackUrl);
    const pathParts = url.pathname.split("/").filter((p) => p.length > 0);
    return pathParts.length > 0 ? pathParts[pathParts.length - 1] : url.hostname;
  } catch {
    return fallbackUrl;
  }
}

function extractVersion(link: string): "v1" | "v2" {
  const matched = /\/v\d+\//[Symbol.match](link);

  if (matched === null) {
    throw new Error(`Unable to parse version: ${matched}`);
  }

  const version = matched[0];

  return version.substring(1, version.length - 1) as "v1" | "v2";
}

function existsVersion(link: string): boolean {
  return /\/v\d+\//.test(link);
}

/**
 * Extracts description from text
 * Supports markdown format: [title](url): description
 * Or plain text after URL
 */
function extractDescription(text: string, url: string): string {
  // Try markdown format with colon: [title](url): description
  const colonIndex = text.indexOf("):");
  if (colonIndex !== -1) {
    const desc = text.substring(colonIndex + 2).trim();
    if (desc) return desc;
  }

  // Try text after markdown link without colon: [title](url) description
  const markdownEnd = text.indexOf(")");
  if (markdownEnd !== -1 && markdownEnd < text.length - 1) {
    const desc = text.substring(markdownEnd + 1).trim();
    // Remove leading separator characters
    const cleaned = desc.replace(/^[:\-–—]\s*/, "").trim();
    if (cleaned) return cleaned;
  }

  // Try text after URL (for plain URL format)
  const urlIndex = text.indexOf(url);
  if (urlIndex !== -1) {
    const afterUrl = text.substring(urlIndex + url.length).trim();
    const cleaned = afterUrl.replace(/^[:\-–—]\s*/, "").trim();
    if (cleaned) return cleaned;
  }

  return "";
}

/**
 * Extracts category from URL
 * Only works for TossPayments URLs, returns "unknown" for others
 */
function extractCategory(link: string): Category {
  try {
    const url = new URL(link);

    for (const category of categories) {
      if (url.pathname.startsWith(`/${category}`)) {
        return category;
      }
    }

    return "unknown";
  } catch {
    // Invalid URL or relative path - return unknown
    return "unknown";
  }
}
