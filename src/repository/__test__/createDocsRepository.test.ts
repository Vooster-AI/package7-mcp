import { describe, it, expect, beforeEach, vi } from "vitest";
import { createDocsRepository } from "../createDocsRepository.js";

// Mock global fetch
global.fetch = vi.fn();

// Mock dependencies
vi.mock("../docs.repository.js");
vi.mock("../../document/parseLLMText.js");
vi.mock("../../document/document.loader.js");

describe("createDocsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful initialization", () => {
    it("should create repository with valid llms.txt", async () => {
      const mockLlmsText = `***
title: Test Document
description: Test description
keyword: test
-----
# Test
https://example.com/test.md`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockLlmsText,
      });

      const repo = await createDocsRepository(
        "test-lib",
        "https://example.com/llms.txt"
      );

      expect(repo).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/llms.txt",
        expect.objectContaining({
          headers: {
            "user-agent": "Package7MCP",
          },
        })
      );
    });

    it("should pass correct libraryId to repository", async () => {
      const mockLlmsText = "# Test content";

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockLlmsText,
      });

      await createDocsRepository("my-library", "https://example.com/llms.txt");

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should use correct user-agent header", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => "# Test",
      });

      await createDocsRepository("test-lib", "https://example.com/llms.txt");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "user-agent": "Package7MCP",
          },
        })
      );
    });
  });

  describe("fetch failures", () => {
    it("should throw error with library context on 404", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        createDocsRepository("test-lib", "https://example.com/llms.txt")
      ).rejects.toThrow("Failed to fetch llms.txt for library 'test-lib'");

      await expect(
        createDocsRepository("test-lib", "https://example.com/llms.txt")
      ).rejects.toThrow("404");

      await expect(
        createDocsRepository("test-lib", "https://example.com/llms.txt")
      ).rejects.toThrow("Not Found");
    });

    it("should throw error with library context on 500", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        createDocsRepository("my-lib", "https://example.com/llms.txt")
      ).rejects.toThrow("Failed to fetch llms.txt for library 'my-lib'");
    });

    it("should throw error on network failure", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network timeout"));

      await expect(
        createDocsRepository("test-lib", "https://example.com/llms.txt")
      ).rejects.toThrow("Failed to create repository for 'test-lib'");

      await expect(
        createDocsRepository("test-lib", "https://example.com/llms.txt")
      ).rejects.toThrow("Network timeout");
    });

    it("should include libraryId in network error message", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Connection refused"));

      try {
        await createDocsRepository("my-library", "https://example.com/llms.txt");
        expect.fail("Should have thrown error");
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        if (e instanceof Error) {
          expect(e.message).toContain("my-library");
          expect(e.message).toContain("Connection refused");
        }
      }
    });
  });

  describe("error context", () => {
    it("should wrap native errors with library context", async () => {
      const originalError = new Error("Parse error");
      (global.fetch as any).mockRejectedValue(originalError);

      try {
        await createDocsRepository("test-lib", "https://example.com/llms.txt");
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        if (e instanceof Error) {
          expect(e.message).toContain("test-lib");
          expect(e.message).toContain("Parse error");
        }
      }
    });

    it("should preserve error details in wrapped error", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      try {
        await createDocsRepository("secure-lib", "https://example.com/llms.txt");
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        if (e instanceof Error) {
          expect(e.message).toContain("secure-lib");
          expect(e.message).toContain("403");
          expect(e.message).toContain("Forbidden");
        }
      }
    });

    it("should handle non-Error throws", async () => {
      (global.fetch as any).mockRejectedValue("String error");

      await expect(
        createDocsRepository("test-lib", "https://example.com/llms.txt")
      ).rejects.toThrow();
    });
  });

  describe("different library IDs", () => {
    it("should handle tosspayments library", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => "# Content",
      });

      await createDocsRepository(
        "tosspayments",
        "https://docs.tosspayments.com/llms.txt"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://docs.tosspayments.com/llms.txt",
        expect.any(Object)
      );
    });

    it("should handle different library with different URL", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => "# Content",
      });

      await createDocsRepository("supabase", "https://supabase.com/llms.txt");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://supabase.com/llms.txt",
        expect.any(Object)
      );
    });

    it("should include correct libraryId in error for any library", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        createDocsRepository("custom-lib", "https://custom.com/llms.txt")
      ).rejects.toThrow("custom-lib");
    });
  });

  describe("parameter validation", () => {
    it("should accept valid parameters", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => "# Test",
      });

      await expect(
        createDocsRepository("valid-lib", "https://example.com/llms.txt")
      ).resolves.toBeDefined();
    });

    it("should call fetch with exact URL provided", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => "# Test",
      });

      const testUrl = "https://test.example.com/path/to/llms.txt";
      await createDocsRepository("test", testUrl);

      expect(global.fetch).toHaveBeenCalledWith(testUrl, expect.any(Object));
    });
  });
});
