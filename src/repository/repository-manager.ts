import { DocsRepository } from "./docs.repository.js";
import { createDocsRepository } from "./createDocsRepository.js";
import {
  findLibrary,
  getLibraryIds,
  LibraryConfig,
} from "../config/libraries.js";
import {
  LibraryNotFoundError,
  LibraryInitializationError,
  LibraryStatus,
} from "./types.js";

/**
 * Singleton manager for library documentation repositories
 *
 * Responsibilities:
 * - Lazy initialization of repositories
 * - Caching of repository instances
 * - Error handling for failed initializations
 * - Thread-safe concurrent request handling
 */
class RepositoryManager {
  private readonly cache = new Map<string, DocsRepository>();
  private readonly initializationErrors = new Map<string, Error>();
  private readonly pendingInitializations = new Map<
    string,
    Promise<DocsRepository>
  >();

  /**
   * Gets or creates a repository for the specified library
   *
   * @param libraryId - Library identifier
   * @returns Promise resolving to the repository instance
   * @throws {LibraryNotFoundError} If library is not configured
   * @throws {LibraryInitializationError} If initialization previously failed
   */
  async getRepository(libraryId: string): Promise<DocsRepository> {
    // Check if library exists in configuration
    const config = findLibrary(libraryId);
    if (!config) {
      throw new LibraryNotFoundError(libraryId, getLibraryIds());
    }

    // Check if already cached
    const cached = this.cache.get(libraryId);
    if (cached) {
      return cached;
    }

    // Check if initialization previously failed
    const previousError = this.initializationErrors.get(libraryId);
    if (previousError) {
      throw new LibraryInitializationError(libraryId, previousError);
    }

    // Check if initialization is in progress (prevent duplicate fetches)
    const pending = this.pendingInitializations.get(libraryId);
    if (pending) {
      return pending;
    }

    // Initialize repository
    const initPromise = this.initializeRepository(config);
    this.pendingInitializations.set(libraryId, initPromise);

    try {
      const repository = await initPromise;
      this.cache.set(libraryId, repository);
      this.pendingInitializations.delete(libraryId);
      return repository;
    } catch (error) {
      this.pendingInitializations.delete(libraryId);
      const err = error instanceof Error ? error : new Error(String(error));
      this.initializationErrors.set(libraryId, err);
      throw new LibraryInitializationError(libraryId, err);
    }
  }

  /**
   * Initializes a repository for a library configuration
   *
   * @param config - Library configuration
   * @returns Promise resolving to the repository instance
   */
  private async initializeRepository(
    config: LibraryConfig
  ): Promise<DocsRepository> {
    console.log(`Initializing repository for library: ${config.id}`);
    const repository = await createDocsRepository(config.id, config.llmsTxtUrl);
    console.log(`Successfully initialized repository for: ${config.id}`);
    return repository;
  }

  /**
   * Gets the status of all configured libraries
   *
   * @returns Array of library status objects
   */
  getLibraryStatuses(): LibraryStatus[] {
    const libraryIds = getLibraryIds();
    return libraryIds.map((id) => ({
      id,
      available: !this.initializationErrors.has(id),
      error: this.initializationErrors.get(id)?.message,
    }));
  }

  /**
   * Clears all cached repositories (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.initializationErrors.clear();
    this.pendingInitializations.clear();
  }
}

/**
 * Singleton instance
 */
export const repositoryManager = new RepositoryManager();
