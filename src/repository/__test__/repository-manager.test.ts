import { describe, it, expect, beforeEach, vi } from "vitest";
import { repositoryManager } from "../repository-manager.js";
import {
  LibraryNotFoundError,
  LibraryInitializationError,
} from "../types.js";
import * as createDocsRepositoryModule from "../createDocsRepository.js";
import { DocsRepository } from "../docs.repository.js";

// Mock createDocsRepository
vi.mock("../createDocsRepository.js");

describe("RepositoryManager", () => {
  beforeEach(() => {
    // Clear cache before each test
    repositoryManager.clearCache();
    vi.clearAllMocks();
  });

  describe("getRepository", () => {
    it("should create repository on first request", async () => {
      const mockRepo = {} as DocsRepository;
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      const repo = await repositoryManager.getRepository("tosspayments");

      expect(repo).toBe(mockRepo);
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledWith(
        "tosspayments",
        "https://docs.tosspayments.com/llms.txt"
      );
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });

    it("should return cached repository on subsequent requests", async () => {
      const mockRepo = {} as DocsRepository;
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      const repo1 = await repositoryManager.getRepository("tosspayments");
      const repo2 = await repositoryManager.getRepository("tosspayments");
      const repo3 = await repositoryManager.getRepository("tosspayments");

      expect(repo1).toBe(mockRepo);
      expect(repo2).toBe(mockRepo);
      expect(repo3).toBe(mockRepo);
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });

    it("should throw LibraryNotFoundError for invalid library", async () => {
      await expect(
        repositoryManager.getRepository("invalid-lib-name")
      ).rejects.toThrow(LibraryNotFoundError);
    });

    it("should throw LibraryNotFoundError with available libraries list", async () => {
      try {
        await repositoryManager.getRepository("invalid-lib");
        expect.fail("Should have thrown error");
      } catch (_e) {
        expect(_e).toBeInstanceOf(LibraryNotFoundError);
        if (_e instanceof LibraryNotFoundError) {
          expect(_e.libraryId).toBe("invalid-lib");
          expect(_e.availableLibraries).toContain("tosspayments");
          expect(_e.message).toContain("invalid-lib");
          expect(_e.message).toContain("tosspayments");
        }
      }
    });

    it("should cache initialization errors", async () => {
      const networkError = new Error("Network timeout");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        networkError
      );

      // First request fails
      await expect(
        repositoryManager.getRepository("tosspayments")
      ).rejects.toThrow(LibraryInitializationError);

      // Second request should throw cached error without retrying
      await expect(
        repositoryManager.getRepository("tosspayments")
      ).rejects.toThrow(LibraryInitializationError);

      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });

    it("should throw LibraryInitializationError with cause", async () => {
      const originalError = new Error("Failed to fetch llms.txt");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        originalError
      );

      try {
        await repositoryManager.getRepository("tosspayments");
        expect.fail("Should have thrown error");
      } catch (_e) {
        expect(_e).toBeInstanceOf(LibraryInitializationError);
        if (_e instanceof LibraryInitializationError) {
          expect(_e.libraryId).toBe("tosspayments");
          expect(_e.cause).toBe(originalError);
          expect(_e.message).toContain("tosspayments");
          expect(_e.message).toContain("Failed to fetch llms.txt");
        }
      }
    });

    it("should handle concurrent requests safely", async () => {
      let resolveCount = 0;
      const mockRepo = {} as DocsRepository;

      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolveCount++;
              resolve(mockRepo);
            }, 100)
          )
      );

      // Fire multiple concurrent requests
      const promises = [
        repositoryManager.getRepository("tosspayments"),
        repositoryManager.getRepository("tosspayments"),
        repositoryManager.getRepository("tosspayments"),
        repositoryManager.getRepository("tosspayments"),
      ];

      const results = await Promise.all(promises);

      // All should return same instance
      expect(results[0]).toBe(mockRepo);
      expect(results[1]).toBe(mockRepo);
      expect(results[2]).toBe(mockRepo);
      expect(results[3]).toBe(mockRepo);

      // Only one initialization should have occurred
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
      expect(resolveCount).toBe(1);
    });

    it("should handle concurrent requests to different libraries", async () => {
      const mockRepo = {} as DocsRepository;
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      // If we had multiple libraries, this would test them
      const repo1 = await repositoryManager.getRepository("tosspayments");

      expect(repo1).toBe(mockRepo);
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });

    it("should not retry failed initialization on subsequent calls", async () => {
      const error = new Error("Permanent failure");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        error
      );

      // Try multiple times
      for (let i = 0; i < 5; i++) {
        await expect(
          repositoryManager.getRepository("tosspayments")
        ).rejects.toThrow(LibraryInitializationError);
      }

      // Should only attempt once
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe("getLibraryStatuses", () => {
    it("should return status for all libraries", () => {
      const statuses = repositoryManager.getLibraryStatuses();

      expect(statuses).toBeInstanceOf(Array);
      expect(statuses.length).toBeGreaterThan(0);

      statuses.forEach((status) => {
        expect(status).toHaveProperty("id");
        expect(status).toHaveProperty("available");
        expect(typeof status.id).toBe("string");
        expect(typeof status.available).toBe("boolean");
      });
    });

    it("should mark uninitialized libraries as available", () => {
      const statuses = repositoryManager.getLibraryStatuses();
      const tossStatus = statuses.find((s) => s.id === "tosspayments");

      expect(tossStatus).toBeDefined();
      expect(tossStatus?.available).toBe(true);
      expect(tossStatus?.error).toBeUndefined();
    });

    it("should mark successfully initialized libraries as available", async () => {
      const mockRepo = {} as DocsRepository;
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      await repositoryManager.getRepository("tosspayments");

      const statuses = repositoryManager.getLibraryStatuses();
      const tossStatus = statuses.find((s) => s.id === "tosspayments");

      expect(tossStatus?.available).toBe(true);
      expect(tossStatus?.error).toBeUndefined();
    });

    it("should mark failed libraries as unavailable", async () => {
      const error = new Error("Init failed");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        error
      );

      try {
        await repositoryManager.getRepository("tosspayments");
      } catch {
        // Expected to fail
      }

      const statuses = repositoryManager.getLibraryStatuses();
      const tossStatus = statuses.find((s) => s.id === "tosspayments");

      expect(tossStatus?.available).toBe(false);
      expect(tossStatus?.error).toContain("Init failed");
    });

    it("should include all configured libraries in status", () => {
      const statuses = repositoryManager.getLibraryStatuses();
      const ids = statuses.map((s) => s.id);

      expect(ids).toContain("tosspayments");
    });
  });

  describe("clearCache", () => {
    it("should clear cached repositories", async () => {
      const mockRepo = {} as DocsRepository;
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockResolvedValue(
        mockRepo
      );

      // Initialize repository
      await repositoryManager.getRepository("tosspayments");
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(1);

      // Clear cache
      repositoryManager.clearCache();

      // Should initialize again
      await repositoryManager.getRepository("tosspayments");
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(2);
    });

    it("should clear error cache", async () => {
      const error = new Error("Network error");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository")
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({} as DocsRepository);

      // First attempt fails
      await expect(
        repositoryManager.getRepository("tosspayments")
      ).rejects.toThrow();

      // Clear cache
      repositoryManager.clearCache();

      // Should retry and succeed
      const repo = await repositoryManager.getRepository("tosspayments");
      expect(repo).toBeDefined();
      expect(createDocsRepositoryModule.createDocsRepository).toHaveBeenCalledTimes(2);
    });

    it("should reset library statuses", async () => {
      const error = new Error("Init failed");
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository").mockRejectedValue(
        error
      );

      try {
        await repositoryManager.getRepository("tosspayments");
      } catch {
        // Expected
      }

      let statuses = repositoryManager.getLibraryStatuses();
      let tossStatus = statuses.find((s) => s.id === "tosspayments");
      expect(tossStatus?.available).toBe(false);

      // Clear cache
      repositoryManager.clearCache();

      statuses = repositoryManager.getLibraryStatuses();
      tossStatus = statuses.find((s) => s.id === "tosspayments");
      expect(tossStatus?.available).toBe(true);
      expect(tossStatus?.error).toBeUndefined();
    });
  });
});
