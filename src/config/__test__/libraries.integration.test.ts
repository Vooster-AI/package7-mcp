import { describe, it, expect } from "vitest";
import { AVAILABLE_LIBRARIES } from "../libraries.js";
import { parseLLMText } from "../../document/parseLLMText.js";
import {
  validateLibrary,
  formatValidationResults,
  type LibraryValidationResult,
} from "../../document/__test__/test-utils.js";

describe("Libraries Integration Test (E2E)", () => {
  // Increase timeout for real HTTP requests
  const TIMEOUT = 30000;

  describe.each(AVAILABLE_LIBRARIES)(
    "Library: $id",
    ({ id, llmsTxtUrl }) => {
      it(
        "should successfully fetch llms.txt",
        async () => {
          const response = await fetch(llmsTxtUrl, {
            headers: {
              "user-agent": "Package7MCP-Test",
            },
          });

          expect(response.ok).toBe(true);
          expect(response.status).toBe(200);

          const text = await response.text();
          expect(text).toBeTruthy();
          expect(text.length).toBeGreaterThan(0);
        },
        TIMEOUT
      );

      it(
        "should successfully parse llms.txt content",
        async () => {
          const response = await fetch(llmsTxtUrl, {
            headers: {
              "user-agent": "Package7MCP-Test",
            },
          });

          expect(response.ok).toBe(true);

          const text = await response.text();
          const docs = parseLLMText(text, id, llmsTxtUrl);

          // Should parse at least one document
          expect(docs.length).toBeGreaterThan(0);

          // Each document should have required fields
          docs.forEach((doc, index) => {
            expect(doc.title, `Document ${index} should have a title`).toBeTruthy();
            expect(doc.link, `Document ${index} should have a link`).toBeTruthy();
            expect(doc.text, `Document ${index} should have text`).toBeTruthy();
            expect(doc.category, `Document ${index} should have a category`).toBeTruthy();

            // All URLs should now be absolute (relative URLs are resolved)
            expect(() => new URL(doc.link), `Document ${index} should have valid absolute URL`).not.toThrow();
            const url = new URL(doc.link);
            expect(url.protocol, `Document ${index} should use http or https`).toMatch(/^https?:$/);
          });
        },
        TIMEOUT
      );
    }
  );

  it(
    "should provide detailed validation report for all libraries",
    async () => {
      const results: LibraryValidationResult[] = [];

      // Validate all libraries
      for (const library of AVAILABLE_LIBRARIES) {
        const result = await validateLibrary(
          library.id,
          library.llmsTxtUrl,
          parseLLMText
        );
        results.push(result);
      }

      // Format and display report
      const report = formatValidationResults(results);
      console.log(report);

      // Count successful vs failed
      const successful = results.filter(
        (r) =>
          r.fetchSuccess &&
          r.parseSuccess &&
          r.validationErrors.length === 0
      );
      const failed = results.filter((r) => !successful.includes(r));

      // Display warnings for failed libraries
      if (failed.length > 0) {
        console.warn("\n⚠️  WARNING: Some libraries failed validation:");
        failed.forEach((r) => {
          console.warn(`  - ${r.libraryId}: ${r.fetchError || r.parseError || "Validation errors"}`);
        });
      }

      // At least one library should succeed
      expect(successful.length).toBeGreaterThan(0);

      // Display individual library results for debugging
      results.forEach((result) => {
        if (result.fetchSuccess && result.parseSuccess) {
          console.log(
            `✅ ${result.libraryId}: ${result.documentCount} documents`
          );
        } else {
          console.warn(
            `❌ ${result.libraryId}: Fetch=${result.fetchSuccess}, Parse=${result.parseSuccess}`
          );
        }
      });
    },
    TIMEOUT * AVAILABLE_LIBRARIES.length
  );
});

describe("Libraries Configuration Validation", () => {
  it("should have at least one library configured", () => {
    expect(AVAILABLE_LIBRARIES.length).toBeGreaterThan(0);
  });

  it("should have valid library configurations", () => {
    AVAILABLE_LIBRARIES.forEach((lib) => {
      expect(lib.id).toBeTruthy();
      expect(lib.id).toMatch(/^[a-z0-9-]+$/);
      expect(lib.llmsTxtUrl).toBeTruthy();
      expect(() => new URL(lib.llmsTxtUrl)).not.toThrow();
    });
  });

  it("should have unique library IDs", () => {
    const ids = AVAILABLE_LIBRARIES.map((lib) => lib.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have HTTPS URLs", () => {
    AVAILABLE_LIBRARIES.forEach((lib) => {
      const url = new URL(lib.llmsTxtUrl);
      expect(url.protocol).toBe("https:");
    });
  });
});
