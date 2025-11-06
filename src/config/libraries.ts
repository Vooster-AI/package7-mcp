import { z } from "zod";

/**
 * Schema for library configuration validation
 */
export const LibraryConfigSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9-]+$/,
      "Library ID must contain only lowercase letters, numbers, and hyphens"
    )
    .describe(
      "Unique identifier for the library (e.g., 'tosspayments', 'supabase')"
    ),
  llmsTxtUrl: z
    .string()
    .url()
    .describe("URL to the library's llms.txt file"),
});

/**
 * Type definition for library configuration
 */
export type LibraryConfig = z.infer<typeof LibraryConfigSchema>;

/**
 * Available libraries configuration
 *
 * To add a new library:
 * 1. Add a new object to this array with id and llmsTxtUrl
 * 2. No code changes required - the system will automatically support it
 *
 * @example
 * {
 *   id: "supabase",
 *   llmsTxtUrl: "https://supabase.com/llms.txt"
 * }
 */
export const AVAILABLE_LIBRARIES: LibraryConfig[] = [
  {
    id: "tosspayments",
    llmsTxtUrl: "https://docs.tosspayments.com/llms.txt",
  },
  {
    id: "supabase",
    llmsTxtUrl: "https://supabase.com/llms.txt",
  },
  {
    id: "clerk",
    llmsTxtUrl: "https://clerk.com/llms.txt",
  },
  {
    id:"vercel-ai-sdk",
    llmsTxtUrl: "https://ai-sdk.dev/llms.txt"
  }
  // Add more libraries here:
];

/**
 * Validates and returns all library configurations
 *
 * @returns Array of validated library configurations
 * @throws {ZodError} If any library configuration is invalid
 */
export function getLibraries(): LibraryConfig[] {
  // Validate at runtime to catch configuration errors early
  return z.array(LibraryConfigSchema).parse(AVAILABLE_LIBRARIES);
}

/**
 * Finds a library configuration by ID
 *
 * @param libraryId - The library identifier to search for
 * @returns The library configuration or undefined if not found
 */
export function findLibrary(libraryId: string): LibraryConfig | undefined {
  return AVAILABLE_LIBRARIES.find((lib) => lib.id === libraryId);
}

/**
 * Gets all available library IDs
 *
 * @returns Array of library IDs
 */
export function getLibraryIds(): string[] {
  return AVAILABLE_LIBRARIES.map((lib) => lib.id);
}
