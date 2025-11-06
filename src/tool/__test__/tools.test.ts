import { describe, it, expect, beforeEach, vi } from "vitest";
import { getLibraryList, getDocuments, getDocumentById } from "../tools.js";
import { repositoryManager } from "../../repository/repository-manager.js";
import {
  LibraryNotFoundError,
  LibraryInitializationError,
} from "../../repository/types.js";
import { SearchMode } from "../../constants/search-mode.js";
import { DocsRepository } from "../../repository/docs.repository.js";

// Mock repository manager
vi.mock("../../repository/repository-manager.js", () => ({
  repositoryManager: {
    getRepository: vi.fn(),
    getLibraryStatuses: vi.fn(),
    clearCache: vi.fn(),
  },
}));

describe("Tool Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLibraryList", () => {
    it("should return list of available libraries", async () => {
      vi.mocked(repositoryManager.getLibraryStatuses).mockReturnValue([
        { id: "tosspayments", available: true },
      ]);

      const result = await getLibraryList();

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("tosspayments");
    });

    it("should include available status for each library", async () => {
      vi.mocked(repositoryManager.getLibraryStatuses).mockReturnValue([
        { id: "tosspayments", available: true },
      ]);

      const result = await getLibraryList();
      const text = result.content[0].text;

      expect(text).toContain("available");
      expect(text).toContain("true");
    });

    it("should show unavailable libraries with error", async () => {
      // This test requires mocking AVAILABLE_LIBRARIES to have multiple entries
      // For now, just test with tosspayments marked as unavailable
      vi.mocked(repositoryManager.getLibraryStatuses).mockReturnValue([
        { id: "tosspayments", available: false, error: "Network timeout" },
      ]);

      const result = await getLibraryList();
      const text = result.content[0].text;

      expect(text).toContain("tosspayments");
      expect(text).toContain("false");
      expect(text).toContain("Network timeout");
    });

    it("should include usage guidance message", async () => {
      vi.mocked(repositoryManager.getLibraryStatuses).mockReturnValue([
        { id: "tosspayments", available: true },
      ]);

      const result = await getLibraryList();
      const text = result.content[0].text;

      expect(text).toContain("Use the 'id' field");
      expect(text).toContain("get-documents");
      expect(text).toContain("document-by-id");
    });

    it("should return JSON formatted library list", async () => {
      vi.mocked(repositoryManager.getLibraryStatuses).mockReturnValue([
        { id: "tosspayments", available: true },
        { id: "supabase", available: false },
        { id: "clerk", available: true },
        { id: "vercel-ai-sdk", available: false },
      ]);

      const result = await getLibraryList();
      const text = (result.content[0] as any).text as string;

      // Should contain valid JSON
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      expect(jsonMatch).not.toBeNull();

      const parsed = JSON.parse(jsonMatch![0]);
      expect(parsed).toHaveLength(4);
      expect(parsed[0].id).toBe("tosspayments");
      expect(parsed[0].available).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(repositoryManager.getLibraryStatuses).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = await getLibraryList();

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unexpected error");
    });

    it("should handle non-Error throws", async () => {
      vi.mocked(repositoryManager.getLibraryStatuses).mockImplementation(() => {
        throw "String error";
      });

      const result = await getLibraryList();

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Failed to retrieve library list");
    });
  });

  describe("getDocuments", () => {
    it("should search documents in specified library", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Mock search results"),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test", "keyword"],
        maxTokens: 25000,
      });

      expect(mockRepo.findV2DocumentsByKeyword).toHaveBeenCalledWith(
        ["test", "keyword"],
        undefined,
        25000
      );
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe("Mock search results");
    });

    it("should pass searchMode to repository", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
        searchMode: SearchMode.PRECISE,
        maxTokens: 10000,
      });

      expect(mockRepo.findV2DocumentsByKeyword).toHaveBeenCalledWith(
        ["test"],
        SearchMode.PRECISE,
        10000
      );
    });

    it("should use default maxTokens when not provided", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      expect(mockRepo.findV2DocumentsByKeyword).toHaveBeenCalledWith(
        ["test"],
        undefined,
        25000
      );
    });

    it("should return error for invalid libraryId", async () => {
      vi.mocked(repositoryManager.getRepository).mockRejectedValue(
        new LibraryNotFoundError("invalid-lib", ["tosspayments"])
      );

      const result = await getDocuments({
        libraryId: "invalid-lib",
        keywords: ["test"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("invalid-lib");
      expect(result.content[0].text).toContain("not found");
    });

    it("should include available libraries in error message", async () => {
      vi.mocked(repositoryManager.getRepository).mockRejectedValue(
        new LibraryNotFoundError("invalid", ["tosspayments", "supabase"])
      );

      const result = await getDocuments({
        libraryId: "invalid",
        keywords: ["test"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("tosspayments");
      expect(result.content[0].text).toContain("supabase");
    });

    it("should return error for library initialization failure", async () => {
      const originalError = new Error("Network timeout");
      vi.mocked(repositoryManager.getRepository).mockRejectedValue(
        new LibraryInitializationError("tosspayments", originalError)
      );

      const result = await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unable to access library");
      expect(result.content[0].text).toContain("tosspayments");
      expect(result.content[0].text).toContain("Network timeout");
    });

    it("should handle unknown errors", async () => {
      vi.mocked(repositoryManager.getRepository).mockRejectedValue(
        new Error("Unknown error")
      );

      const result = await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown error");
    });

    it("should handle non-Error throws", async () => {
      vi.mocked(repositoryManager.getRepository).mockRejectedValue("String error");

      const result = await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("An error occurred");
    });

    it("should handle empty search results", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue(""),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocuments({
        libraryId: "tosspayments",
        keywords: ["nonexistent"],
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe("");
    });

    it("should handle multiple keywords", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["keyword1", "keyword2", "keyword3"],
        maxTokens: 5000,
      });

      expect(mockRepo.findV2DocumentsByKeyword).toHaveBeenCalledWith(
        ["keyword1", "keyword2", "keyword3"],
        undefined,
        5000
      );
    });
  });

  describe("getDocumentById", () => {
    it("should retrieve document from specified library", async () => {
      const mockDoc = {
        getChunks: () => [
          { text: "Chunk 1 content" },
          { text: "Chunk 2 content" },
        ],
      };
      const mockRepo = {
        findOneById: vi.fn().mockReturnValue(mockDoc),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "42",
      });

      expect(mockRepo.findOneById).toHaveBeenCalledWith(42);
      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toBe("Chunk 1 content");
      expect(result.content[1].text).toBe("Chunk 2 content");
    });

    it("should parse string id to number", async () => {
      const mockDoc = {
        getChunks: () => [{ text: "Content" }],
      };
      const mockRepo = {
        findOneById: vi.fn().mockReturnValue(mockDoc),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      await getDocumentById({
        libraryId: "tosspayments",
        id: "123",
      });

      expect(mockRepo.findOneById).toHaveBeenCalledWith(123);
    });

    it("should return error for invalid document ID", async () => {
      const mockRepo = {} as DocsRepository;
      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "not-a-number",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid document ID");
    });

    it("should return error for empty string ID", async () => {
      const mockRepo = {} as DocsRepository;
      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid document ID");
    });

    it("should return error when document not found", async () => {
      const mockRepo = {
        findOneById: vi.fn().mockReturnValue(null),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "999",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Document not found");
      expect(result.content[0].text).toContain("tosspayments");
      expect(result.content[0].text).toContain("999");
    });

    it("should return error for invalid libraryId", async () => {
      vi.mocked(repositoryManager.getRepository).mockRejectedValue(
        new LibraryNotFoundError("invalid", ["tosspayments"])
      );

      const result = await getDocumentById({
        libraryId: "invalid",
        id: "42",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("invalid");
      expect(result.content[0].text).toContain("not found");
    });

    it("should return error for library initialization failure", async () => {
      const originalError = new Error("Failed to load");
      vi.mocked(repositoryManager.getRepository).mockRejectedValue(
        new LibraryInitializationError("tosspayments", originalError)
      );

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "42",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unable to access library");
      expect(result.content[0].text).toContain("tosspayments");
      expect(result.content[0].text).toContain("Failed to load");
    });

    it("should handle unknown errors", async () => {
      const mockRepo = {
        findOneById: vi.fn().mockImplementation(() => {
          throw new Error("Database error");
        }),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "42",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Database error");
    });

    it("should handle non-Error throws", async () => {
      const mockRepo = {
        findOneById: vi.fn().mockImplementation(() => {
          throw "String error";
        }),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "42",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("An error occurred");
    });

    it("should handle document with single chunk", async () => {
      const mockDoc = {
        getChunks: () => [{ text: "Single chunk" }],
      };
      const mockRepo = {
        findOneById: vi.fn().mockReturnValue(mockDoc),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "1",
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("Single chunk");
    });

    it("should handle document with many chunks", async () => {
      const mockDoc = {
        getChunks: () => [
          { text: "Chunk 1" },
          { text: "Chunk 2" },
          { text: "Chunk 3" },
          { text: "Chunk 4" },
          { text: "Chunk 5" },
        ],
      };
      const mockRepo = {
        findOneById: vi.fn().mockReturnValue(mockDoc),
      } as unknown as DocsRepository;

      vi.mocked(repositoryManager.getRepository).mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "1",
      });

      expect(result.content).toHaveLength(5);
    });
  });
});
