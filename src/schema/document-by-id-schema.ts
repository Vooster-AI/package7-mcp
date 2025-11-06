import { z } from "zod";
import { getLibraryIds } from "../config/libraries.js";

/**
 * Schema for document-by-id tool parameters
 */
export const DocumentByIdSchema = {
  libraryId: z
    .string()
    .min(1)
    .describe(
      `Library identifier. Available libraries: ${getLibraryIds().join(", ")}`
    ),
  id: z.string().describe("Document ID"),
};

/**
 * Type for document-by-id parameters
 */
export type DocumentByIdParams = {
  libraryId: string;
  id: string;
};
