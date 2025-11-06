import { describe, expect, it } from "vitest";
import {
  isAbsoluteUrl,
  resolveUrl,
  extractBaseUrl,
} from "../url-utils.js";

describe("URL Utils", () => {
  describe("isAbsoluteUrl", () => {
    it("should return true for absolute HTTP URLs", () => {
      expect(isAbsoluteUrl("http://example.com")).toBe(true);
      expect(isAbsoluteUrl("http://example.com/path")).toBe(true);
    });

    it("should return true for absolute HTTPS URLs", () => {
      expect(isAbsoluteUrl("https://example.com")).toBe(true);
      expect(isAbsoluteUrl("https://example.com/path")).toBe(true);
    });

    it("should return false for relative URLs starting with /", () => {
      expect(isAbsoluteUrl("/path/to/resource")).toBe(false);
      expect(isAbsoluteUrl("/")).toBe(false);
    });

    it("should return false for relative URLs without /", () => {
      expect(isAbsoluteUrl("path/to/resource")).toBe(false);
      expect(isAbsoluteUrl("resource")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isAbsoluteUrl("")).toBe(false);
    });

    it("should handle URLs with query strings", () => {
      expect(isAbsoluteUrl("https://example.com/path?query=1")).toBe(true);
      expect(isAbsoluteUrl("/path?query=1")).toBe(false);
    });

    it("should handle URLs with fragments", () => {
      expect(isAbsoluteUrl("https://example.com/path#section")).toBe(true);
      expect(isAbsoluteUrl("/path#section")).toBe(false);
    });

    it("should handle malformed URLs gracefully", () => {
      expect(isAbsoluteUrl("http://localhost:3000.")).toBe(false);
      expect(isAbsoluteUrl("not a url")).toBe(false);
    });
  });

  describe("extractBaseUrl", () => {
    it("should extract base URL from https://domain.com/path", () => {
      const result = extractBaseUrl("https://docs.tosspayments.com/llms.txt");
      expect(result).toBe("https://docs.tosspayments.com");
    });

    it("should extract base URL from http URLs", () => {
      const result = extractBaseUrl("http://example.com/some/path");
      expect(result).toBe("http://example.com");
    });

    it("should handle URLs with ports", () => {
      const result = extractBaseUrl("https://example.com:8080/path");
      expect(result).toBe("https://example.com:8080");
    });

    it("should handle URLs with subdomains", () => {
      const result = extractBaseUrl("https://api.supabase.com/llms.txt");
      expect(result).toBe("https://api.supabase.com");
    });

    it("should handle URLs with query strings", () => {
      const result = extractBaseUrl("https://example.com/path?query=1");
      expect(result).toBe("https://example.com");
    });

    it("should handle URLs with fragments", () => {
      const result = extractBaseUrl("https://example.com/path#section");
      expect(result).toBe("https://example.com");
    });

    it("should throw error for invalid URLs", () => {
      expect(() => extractBaseUrl("not a url")).toThrow();
      expect(() => extractBaseUrl("/relative/path")).toThrow();
    });

    it("should handle URLs without paths", () => {
      const result = extractBaseUrl("https://example.com");
      expect(result).toBe("https://example.com");
    });
  });

  describe("resolveUrl", () => {
    describe("absolute URLs", () => {
      it("should return absolute URLs unchanged", () => {
        const result = resolveUrl(
          "https://example.com/path",
          "https://base.com"
        );
        expect(result).toBe("https://example.com/path");
      });

      it("should preserve query strings and fragments", () => {
        const result = resolveUrl(
          "https://example.com/path?q=1#section",
          "https://base.com"
        );
        expect(result).toBe("https://example.com/path?q=1#section");
      });
    });

    describe("relative URLs with leading slash", () => {
      it("should resolve /path relative to base", () => {
        const result = resolveUrl("/docs/api", "https://example.com");
        expect(result).toBe("https://example.com/docs/api");
      });

      it("should preserve query strings", () => {
        const result = resolveUrl("/docs/api?v=1", "https://example.com");
        expect(result).toBe("https://example.com/docs/api?v=1");
      });

      it("should preserve fragments", () => {
        const result = resolveUrl("/docs/api#section", "https://example.com");
        expect(result).toBe("https://example.com/docs/api#section");
      });

      it("should work with base URLs that have paths", () => {
        const result = resolveUrl(
          "/docs/api",
          "https://example.com/some/path"
        );
        expect(result).toBe("https://example.com/docs/api");
      });

      it("should handle base URLs with ports", () => {
        const result = resolveUrl("/docs/api", "https://example.com:8080");
        expect(result).toBe("https://example.com:8080/docs/api");
      });
    });

    describe("relative URLs without leading slash", () => {
      it("should resolve path relative to base directory", () => {
        const result = resolveUrl(
          "api/endpoint",
          "https://example.com/docs/"
        );
        expect(result).toBe("https://example.com/docs/api/endpoint");
      });

      it("should handle base URLs without trailing slash", () => {
        const result = resolveUrl("api/endpoint", "https://example.com/docs");
        expect(result).toBe("https://example.com/api/endpoint");
      });

      it("should handle multiple path segments", () => {
        const result = resolveUrl(
          "providers/ai-sdk-providers/deepseek",
          "https://ai-sdk.dev/"
        );
        expect(result).toBe(
          "https://ai-sdk.dev/providers/ai-sdk-providers/deepseek"
        );
      });
    });

    describe("edge cases", () => {
      it("should handle root path /", () => {
        const result = resolveUrl("/", "https://example.com");
        expect(result).toBe("https://example.com/");
      });

      it("should handle empty relative path", () => {
        const result = resolveUrl("", "https://example.com/docs");
        expect(result).toBe("https://example.com/docs");
      });

      it("should handle . as current directory", () => {
        const result = resolveUrl(".", "https://example.com/docs/");
        expect(result).toBe("https://example.com/docs/");
      });

      it("should handle .. as parent directory", () => {
        const result = resolveUrl("../api", "https://example.com/docs/");
        expect(result).toBe("https://example.com/api");
      });

      it("should throw for invalid base URLs", () => {
        expect(() => resolveUrl("/path", "not a url")).toThrow();
      });

      it("should handle malformed URLs with trailing dot", () => {
        // Malformed absolute URLs should throw
        expect(() =>
          resolveUrl("http://localhost:3000.", "https://example.com")
        ).toThrow();
      });
    });

    describe("real-world examples", () => {
      it("should resolve Vercel AI SDK relative paths", () => {
        const base = "https://ai-sdk.dev/llms.txt";
        expect(resolveUrl("/docs/ai-sdk-core/overview", base)).toBe(
          "https://ai-sdk.dev/docs/ai-sdk-core/overview"
        );
        expect(resolveUrl("/providers/ai-sdk-providers/deepseek", base)).toBe(
          "https://ai-sdk.dev/providers/ai-sdk-providers/deepseek"
        );
      });

      it("should resolve Supabase relative paths", () => {
        const base = "https://supabase.com/llms.txt";
        expect(resolveUrl("/docs/guides/auth", base)).toBe(
          "https://supabase.com/docs/guides/auth"
        );
      });

      it("should resolve TossPayments absolute URLs unchanged", () => {
        const base = "https://docs.tosspayments.com/llms.txt";
        const url = "https://docs.tosspayments.com/guides/v2/payment";
        expect(resolveUrl(url, base)).toBe(url);
      });
    });
  });
});
