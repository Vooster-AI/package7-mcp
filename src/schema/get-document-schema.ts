import { z } from "zod";
import { SearchMode } from "../constants/search-mode.js";
import { getLibraryIds } from "../config/libraries.js";

export const GetDocumentSchema = {
  libraryId: z
    .string()
    .min(1)
    .describe(
      `Library identifier to search in. Available libraries: ${getLibraryIds().join(", ")}`
    ),
  keywords: z
    .array(z.string())
    .describe(
      "Array of keywords to search. Example: ['payment-widget', 'integration'] - Key terms to find highly relevant documents"
    ),
  searchMode: z
    .nativeEnum(SearchMode)
    .default(SearchMode.BALANCED)
    .describe(
      `
      Search results relevance and accuracy vary by search mode.

      Search modes:
      - broad: Broad results (includes lower relevance, for concept exploration)
      - balanced: Balanced results (general search)
      - precise: Exact results only (when accurate answers are needed)
    `
    )
    .optional(),
  maxTokens: z
    .number()
    .int()
    .min(500)
    .max(50000)
    .default(25000)
    .describe(
      `
      Maximum number of tokens to include in response. Allowed token range is 500 to 50000.

      Recommended values:
      - 1000: Simple answer (fast response)
      - 10000: Balanced detail level
      - 25000: Very detailed analysis (default)
      - 50000: Maximum detail (long documents or complex content) - Note: May exceed allowed token size, caution needed.
    `
    )
    .optional(),
};

export type GetDocumentParams = {
  libraryId: string;
  keywords: string[];
  searchMode?: SearchMode;
  maxTokens?: number;
};
