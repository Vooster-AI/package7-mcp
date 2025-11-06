import { RawDocs } from "../types.js";
import { fetchWithHeaders } from "../../utils/fetch.js";

/**
 * Validates that a RawDocs array is properly formatted
 */
export function validateRawDocs(docs: RawDocs[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(docs)) {
    errors.push("Result is not an array");
    return { isValid: false, errors };
  }

  if (docs.length === 0) {
    errors.push("No documents were parsed");
  }

  docs.forEach((doc, index) => {
    if (!doc.title || doc.title.trim() === "") {
      errors.push(`Document ${index}: missing or empty title`);
    }

    if (!doc.link || !isValidUrl(doc.link)) {
      errors.push(`Document ${index}: invalid or missing link: ${doc.link}`);
    } else {
      // Validate that it's an absolute URL (not relative)
      try {
        const url = new URL(doc.link);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push(`Document ${index}: URL must use http or https protocol: ${doc.link}`);
        }
      } catch {
        errors.push(`Document ${index}: malformed URL: ${doc.link}`);
      }
    }

    if (!doc.text || doc.text.trim() === "") {
      errors.push(`Document ${index}: missing or empty text`);
    }

    if (!doc.category) {
      errors.push(`Document ${index}: missing category`);
    }

    // Description is optional but should be a string
    if (typeof doc.description !== "string") {
      errors.push(`Document ${index}: description must be a string`);
    }

    // Version is optional - allow v1-v9 for flexibility
    if (doc.version !== undefined && !/^v[1-9]$/.test(doc.version)) {
      errors.push(`Document ${index}: invalid version: ${doc.version}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that an HTTP response is successful
 */
export function validateHttpResponse(response: Response): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!response.ok) {
    errors.push(
      `HTTP request failed with status ${response.status}: ${response.statusText}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates llms.txt content format
 */
export async function validateLlmsTxtContent(text: string): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text || text.trim() === "") {
    errors.push("Content is empty");
    return { isValid: false, errors, warnings };
  }

  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    errors.push("No content lines found");
    return { isValid: false, errors, warnings };
  }

  // Check if there are any URLs
  const hasUrls = lines.some((line) => /https?:\/\/[^\s]+/.test(line));
  if (!hasUrls) {
    errors.push("No URLs found in content");
  }

  // Check for markdown format
  const hasMarkdownLinks = lines.some((line) => /\[.+\]\(.+\)/.test(line));
  if (!hasMarkdownLinks) {
    warnings.push(
      "No markdown-formatted links found (expected format: [title](url))"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Result type for library validation
 */
export interface LibraryValidationResult {
  libraryId: string;
  llmsTxtUrl: string;
  fetchSuccess: boolean;
  fetchError?: string;
  parseSuccess: boolean;
  parseError?: string;
  documentCount: number;
  validationErrors: string[];
  validationWarnings: string[];
}

/**
 * Validates a single library's llms.txt endpoint and parsing
 */
export async function validateLibrary(
  libraryId: string,
  llmsTxtUrl: string,
  parseLLMText: (text: string, libraryId?: string, llmsTxtUrl?: string) => RawDocs[]
): Promise<LibraryValidationResult> {
  const result: LibraryValidationResult = {
    libraryId,
    llmsTxtUrl,
    fetchSuccess: false,
    parseSuccess: false,
    documentCount: 0,
    validationErrors: [],
    validationWarnings: [],
  };

  try {
    // Step 1: Fetch llms.txt
    const response = await fetchWithHeaders(llmsTxtUrl);

    const httpValidation = validateHttpResponse(response);
    if (!httpValidation.isValid) {
      result.fetchError = httpValidation.errors.join("; ");
      return result;
    }

    result.fetchSuccess = true;

    // Step 2: Get and validate content
    const text = await response.text();
    const contentValidation = await validateLlmsTxtContent(text);

    if (!contentValidation.isValid) {
      result.fetchError = `Content validation failed: ${contentValidation.errors.join("; ")}`;
      result.validationWarnings.push(...contentValidation.warnings);
      return result;
    }

    result.validationWarnings.push(...contentValidation.warnings);

    // Step 3: Parse content
    let docs: RawDocs[];
    try {
      docs = parseLLMText(text, libraryId, llmsTxtUrl);
      result.parseSuccess = true;
    } catch (error) {
      result.parseError =
        error instanceof Error ? error.message : String(error);
      return result;
    }

    // Step 4: Validate parsed documents
    const docsValidation = validateRawDocs(docs);
    result.documentCount = docs.length;

    if (!docsValidation.isValid) {
      result.validationErrors.push(...docsValidation.errors);
    }
  } catch (error) {
    result.fetchError = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Formats validation results for console output
 */
export function formatValidationResults(
  results: LibraryValidationResult[]
): string {
  const lines: string[] = [];
  lines.push("\n=== Library Validation Report ===\n");

  const successful = results.filter(
    (r) => r.fetchSuccess && r.parseSuccess && r.validationErrors.length === 0
  );
  const failed = results.filter((r) => !successful.includes(r));

  lines.push(
    `Total: ${results.length} | Passed: ${successful.length} | Failed: ${failed.length}\n`
  );

  if (successful.length > 0) {
    lines.push("✅ Successful Libraries:");
    successful.forEach((r) => {
      lines.push(
        `  - ${r.libraryId}: ${r.documentCount} documents parsed successfully`
      );
      if (r.validationWarnings.length > 0) {
        r.validationWarnings.forEach((w) => lines.push(`    ⚠️  ${w}`));
      }
    });
    lines.push("");
  }

  if (failed.length > 0) {
    lines.push("❌ Failed Libraries:");
    failed.forEach((r) => {
      lines.push(`  - ${r.libraryId}:`);
      if (!r.fetchSuccess) {
        lines.push(`    ❌ Fetch failed: ${r.fetchError}`);
      }
      if (r.fetchSuccess && !r.parseSuccess) {
        lines.push(`    ❌ Parse failed: ${r.parseError}`);
      }
      if (r.validationErrors.length > 0) {
        lines.push(`    ❌ Validation errors:`);
        r.validationErrors.forEach((e) => lines.push(`       - ${e}`));
      }
      if (r.validationWarnings.length > 0) {
        r.validationWarnings.forEach((w) => lines.push(`    ⚠️  ${w}`));
      }
    });
    lines.push("");
  }

  return lines.join("\n");
}
