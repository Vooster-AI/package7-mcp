import { describe, it, expect } from "vitest";
import {
  LibraryConfigSchema,
  getLibraries,
  findLibrary,
  getLibraryIds,
  AVAILABLE_LIBRARIES,
} from "../libraries.js";

describe("Library Configuration", () => {
  describe("LibraryConfigSchema", () => {
    it("should validate correct configuration", () => {
      const valid = {
        id: "test-lib",
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(valid)).not.toThrow();
    });

    it("should reject empty id", () => {
      const invalid = {
        id: "",
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });

    it("should reject invalid id format with uppercase", () => {
      const invalid = {
        id: "Invalid-Library",
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow(
        "Library ID must contain only lowercase letters, numbers, and hyphens"
      );
    });

    it("should reject invalid id format with spaces", () => {
      const invalid = {
        id: "invalid library",
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });

    it("should reject invalid id format with special characters", () => {
      const invalid = {
        id: "invalid_lib!",
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });

    it("should accept valid id with hyphens and numbers", () => {
      const valid = {
        id: "test-lib-123",
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(valid)).not.toThrow();
    });

    it("should reject invalid URL", () => {
      const invalid = {
        id: "test-lib",
        llmsTxtUrl: "not-a-url",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });

    it("should reject relative URL", () => {
      const invalid = {
        id: "test-lib",
        llmsTxtUrl: "/relative/path",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });

    it("should reject missing llmsTxtUrl", () => {
      const invalid = {
        id: "test-lib",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });

    it("should reject missing id", () => {
      const invalid = {
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });
  });

  describe("getLibraries", () => {
    it("should return all configured libraries", () => {
      const libraries = getLibraries();
      expect(libraries).toBeInstanceOf(Array);
      expect(libraries.length).toBeGreaterThan(0);
    });

    it("should return libraries with valid structure", () => {
      const libraries = getLibraries();
      libraries.forEach((lib) => {
        expect(lib).toHaveProperty("id");
        expect(lib).toHaveProperty("llmsTxtUrl");
        expect(typeof lib.id).toBe("string");
        expect(typeof lib.llmsTxtUrl).toBe("string");
      });
    });

    it("should include tosspayments library", () => {
      const libraries = getLibraries();
      const tosspayments = libraries.find((lib) => lib.id === "tosspayments");
      expect(tosspayments).toBeDefined();
      expect(tosspayments?.llmsTxtUrl).toContain("docs.tosspayments.com");
    });

    it("should validate all libraries against schema", () => {
      const libraries = getLibraries();
      libraries.forEach((lib) => {
        expect(() => LibraryConfigSchema.parse(lib)).not.toThrow();
      });
    });
  });

  describe("findLibrary", () => {
    it("should find existing library by id", () => {
      const lib = findLibrary("tosspayments");
      expect(lib).toBeDefined();
      expect(lib?.id).toBe("tosspayments");
      expect(lib?.llmsTxtUrl).toContain("docs.tosspayments.com");
    });

    it("should return undefined for non-existent library", () => {
      const lib = findLibrary("nonexistent-library");
      expect(lib).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      const lib = findLibrary("");
      expect(lib).toBeUndefined();
    });

    it("should be case-sensitive", () => {
      const lib = findLibrary("TossPayments");
      expect(lib).toBeUndefined();
    });
  });

  describe("getLibraryIds", () => {
    it("should return array of library ids", () => {
      const ids = getLibraryIds();
      expect(ids).toBeInstanceOf(Array);
      expect(ids.length).toBeGreaterThan(0);
    });

    it("should include tosspayments", () => {
      const ids = getLibraryIds();
      expect(ids).toContain("tosspayments");
    });

    it("should return all string values", () => {
      const ids = getLibraryIds();
      ids.forEach((id) => {
        expect(typeof id).toBe("string");
      });
    });

    it("should have unique ids", () => {
      const ids = getLibraryIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should match length of AVAILABLE_LIBRARIES", () => {
      const ids = getLibraryIds();
      expect(ids.length).toBe(AVAILABLE_LIBRARIES.length);
    });
  });

  describe("AVAILABLE_LIBRARIES", () => {
    it("should have at least one library configured", () => {
      expect(AVAILABLE_LIBRARIES.length).toBeGreaterThan(0);
    });

    it("should have unique library ids", () => {
      const ids = AVAILABLE_LIBRARIES.map((lib) => lib.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have valid URLs for all libraries", () => {
      AVAILABLE_LIBRARIES.forEach((lib) => {
        expect(lib.llmsTxtUrl).toMatch(/^https?:\/\//);
      });
    });

    it("should have valid id format for all libraries", () => {
      AVAILABLE_LIBRARIES.forEach((lib) => {
        expect(lib.id).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });
});
