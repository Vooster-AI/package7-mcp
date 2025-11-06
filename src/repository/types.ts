/**
 * Status of a library initialization
 */
export type LibraryStatus = {
  id: string;
  available: boolean;
  error?: string;
};

/**
 * Error thrown when library is not found in configuration
 */
export class LibraryNotFoundError extends Error {
  constructor(
    public readonly libraryId: string,
    public readonly availableLibraries: string[]
  ) {
    super(
      `Library '${libraryId}' not found. Available libraries: ${availableLibraries.join(", ")}`
    );
    this.name = "LibraryNotFoundError";
  }
}

/**
 * Error thrown when library initialization fails
 */
export class LibraryInitializationError extends Error {
  constructor(
    public readonly libraryId: string,
    public readonly cause: Error
  ) {
    super(`Failed to initialize library '${libraryId}': ${cause.message}`);
    this.name = "LibraryInitializationError";
  }
}
