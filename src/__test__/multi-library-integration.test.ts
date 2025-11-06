import { describe, it, expect, beforeEach, vi } from "vitest";
import { repositoryManager } from "../repository/repository-manager.js";
import { getLibraryList, getDocuments, getDocumentById } from "../tool/tools.js";
import * as createDocsRepositoryModule from "../repository/createDocsRepository.js";
import { DocsRepository } from "../repository/docs.repository.js";

// Mock createDocsRepository
vi.mock("../repository/createDocsRepository.js");

describe("Multi-Library Integration", () => {
  beforeEach(() => {
    repositoryManager.clearCache();
    vi.clearAllMocks();
  });

  describe("End-to-end workflow", () => {
    it("should support discover -> search -> retrieve flow", async () => {
      // Step 1: Discover available libraries
      const libraryListResult = await getLibraryList();
      expect(libraryListResult.isError).toBeUndefined();
      expect(libraryListResult.content[0].text).toContain("tosspayments");

      // Step 2: Search documents
      const mockSearchResults = "원본문서 ID : 42\n\n# 결제 가이드\n\n결제 API 사용법...";
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue(mockSearchResults),
        findOneById: vi.fn().mockReturnValue({
          getChunks: () => [
            { text: "# 결제 가이드" },
            { text: "결제 API 사용법 상세 내용..." },
          ],
        }),
      } as unknown as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      const searchResult = await getDocuments({
        libraryId: "tosspayments",
        keywords: ["결제"],
        maxTokens: 5000,
      });

      expect(searchResult.isError).toBeUndefined();
      expect(searchResult.content[0].text).toContain("결제");

      // Step 3: Retrieve full document by ID
      const docResult = await getDocumentById({
        libraryId: "tosspayments",
        id: "42",
      });

      expect(docResult.isError).toBeUndefined();
      expect(docResult.content.length).toBeGreaterThan(0);
    });

    it("should handle library not found in workflow", async () => {
      const result = await getDocuments({
        libraryId: "nonexistent",
        keywords: ["test"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("Repository initialization and caching", () => {
    it("should initialize repository once and reuse for multiple requests", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
        findOneById: vi.fn().mockReturnValue({
          getChunks: () => [{ text: "Content" }],
        }),
      } as unknown as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      // Make multiple requests
      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test1"],
      });

      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test2"],
      });

      await getDocumentById({
        libraryId: "tosspayments",
        id: "1",
      });

      // Repository should be created only once
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });

    it("should handle concurrent requests to same library", async () => {
      let initializationCount = 0;
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
      } as unknown as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockImplementation(
        () =>
          new Promise((resolve) => {
            initializationCount++;
            setTimeout(() => resolve(mockRepo), 100);
          })
      );

      // Fire concurrent requests
      const requests = Promise.all([
        getDocuments({ libraryId: "tosspayments", keywords: ["test1"] }),
        getDocuments({ libraryId: "tosspayments", keywords: ["test2"] }),
        getDocuments({ libraryId: "tosspayments", keywords: ["test3"] }),
      ]);

      const results = await requests;

      // All should succeed
      results.forEach((result) => {
        expect(result.isError).toBeUndefined();
      });

      // Only one initialization should occur
      expect(initializationCount).toBe(1);
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });

    it("should isolate errors between libraries", async () => {
      // If we had multiple libraries, this would test isolation
      // For now, test that one failed initialization doesn't crash the system

      const error = new Error("Network error");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        error
      );

      const result = await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      expect(result.isError).toBe(true);

      // System should still be functional
      const listResult = await getLibraryList();
      expect(listResult.isError).toBeUndefined();
    });
  });

  describe("Error isolation", () => {
    it("should not affect library list when library fails", async () => {
      const error = new Error("Init failed");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        error
      );

      // Try to use a library (will fail)
      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      // Library list should still work
      const listResult = await getLibraryList();
      expect(listResult.isError).toBeUndefined();
      expect(listResult.content[0].text).toContain("tosspayments");
    });

    it("should show failed library as unavailable in status", async () => {
      const error = new Error("Network timeout");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        error
      );

      // Try to initialize (will fail)
      try {
        await repositoryManager.getRepository("tosspayments");
      } catch {
        // Expected
      }

      // Check status
      const listResult = await getLibraryList();
      const text = listResult.content[0].text;

      expect(text).toContain("tosspayments");
      expect(text).toContain("false");
      expect(text).toContain("Network timeout");
    });

    it("should not retry failed library initialization", async () => {
      const error = new Error("Permanent failure");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        error
      );

      // Try multiple times
      for (let i = 0; i < 3; i++) {
        const result = await getDocuments({
          libraryId: "tosspayments",
          keywords: ["test"],
        });
        expect(result.isError).toBe(true);
      }

      // Should only attempt initialization once
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe("Repository caching across tools", () => {
    it("should share repository between getDocuments and getDocumentById", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Search results"),
        findOneById: vi.fn().mockReturnValue({
          getChunks: () => [{ text: "Content" }],
        }),
      } as unknown as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      // Use getDocuments
      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      // Use getDocumentById (should use same repository)
      await getDocumentById({
        libraryId: "tosspayments",
        id: "1",
      });

      // Should initialize only once
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);

      // Both methods should have been called
      expect(mockRepo.findV2DocumentsByKeyword).toHaveBeenCalled();
      expect(mockRepo.findOneById).toHaveBeenCalled();
    });

    it("should maintain cache across multiple tool types", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
        findOneById: vi.fn().mockReturnValue({
          getChunks: () => [{ text: "Doc" }],
        }),
      } as unknown as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      // Multiple different operations
      await getDocuments({ libraryId: "tosspayments", keywords: ["a"] });
      await getDocuments({ libraryId: "tosspayments", keywords: ["b"] });
      await getDocumentById({ libraryId: "tosspayments", id: "1" });
      await getDocumentById({ libraryId: "tosspayments", id: "2" });

      // Should initialize only once
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe("Library status tracking", () => {
    it("should show uninitialized library as available", async () => {
      const listResult = await getLibraryList();
      const text = (listResult.content[0] as any).text as string;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const libraries = JSON.parse(jsonMatch![0]);

      const tosspayments = libraries.find((lib: any) => lib.id === "tosspayments");
      expect(tosspayments.available).toBe(true);
    });

    it("should update status after successful initialization", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
      } as unknown as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      // Initialize library
      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      // Check status
      const listResult = await getLibraryList();
      const text = (listResult.content[0] as any).text as string;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const libraries = JSON.parse(jsonMatch![0]);

      const tosspayments = libraries.find((lib: any) => lib.id === "tosspayments");
      expect(tosspayments.available).toBe(true);
      expect(tosspayments.error).toBeUndefined();
    });

    it("should update status after failed initialization", async () => {
      const error = new Error("Failed to load");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        error
      );

      // Try to initialize (will fail)
      await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
      });

      // Check status
      const listResult = await getLibraryList();
      const text = (listResult.content[0] as any).text as string;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const libraries = JSON.parse(jsonMatch![0]);

      const tosspayments = libraries.find((lib: any) => lib.id === "tosspayments");
      expect(tosspayments.available).toBe(false);
      expect(tosspayments.error).toContain("Failed to load");
    });
  });

  describe("Concurrent access patterns", () => {
    it("should handle mixed concurrent requests", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
        findOneById: vi.fn().mockReturnValue({
          getChunks: () => [{ text: "Doc" }],
        }),
      } as unknown as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockRepo), 50))
      );

      // Mixed concurrent requests
      const requests = Promise.all([
        getDocuments({ libraryId: "tosspayments", keywords: ["a"] }),
        getDocumentById({ libraryId: "tosspayments", id: "1" }),
        getDocuments({ libraryId: "tosspayments", keywords: ["b"] }),
        getDocumentById({ libraryId: "tosspayments", id: "2" }),
      ]);

      const results = await requests;

      // All should succeed
      results.forEach((result) => {
        expect(result.isError).toBeUndefined();
      });

      // Should initialize only once
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid sequential requests", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Results"),
      } as unknown as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      // Rapid sequential requests
      for (let i = 0; i < 10; i++) {
        await getDocuments({
          libraryId: "tosspayments",
          keywords: [`test${i}`],
        });
      }

      // Should initialize only once
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);

      // Should call search 10 times
      expect(mockRepo.findV2DocumentsByKeyword).toHaveBeenCalledTimes(10);
    });
  });
});
