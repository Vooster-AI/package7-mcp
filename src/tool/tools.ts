import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { isNativeError } from "node:util/types";

import { GetDocumentParams } from "../schema/get-document-schema.js";
import { DocumentByIdParams } from "../schema/document-by-id-schema.js";
import { repositoryManager } from "../repository/repository-manager.js";
import {
  LibraryNotFoundError,
  LibraryInitializationError,
} from "../repository/types.js";
import { getLibraries } from "../config/libraries.js";

/**
 * Get list of available libraries with their status
 *
 * @returns List of library IDs with availability status
 *
 * @example
 * ```typescript
 * const result = await getLibraryList();
 * // Returns: { content: [{ type: "text", text: "Available libraries:\n\n..." }] }
 * ```
 */
export async function getLibraryList(): Promise<CallToolResult> {
  try {
    const libraries = getLibraries();
    const statuses = repositoryManager.getLibraryStatuses();

    // Combine config with runtime status
    const libraryList = libraries.map((lib) => {
      const status = statuses.find((s) => s.id === lib.id);
      return {
        id: lib.id,
        available: status?.available ?? true,
        error: status?.error,
      };
    });

    const responseText = JSON.stringify(libraryList, null, 2);

    return {
      content: [
        {
          type: "text",
          text: `Available libraries:\n\n${responseText}\n\nUse the 'id' field when calling get-documents or document-by-id.`,
        },
      ],
    };
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: isNativeError(e)
            ? e.message
            : "Failed to retrieve library list",
        },
      ],
      isError: true,
    };
  }
}

/**
 * Search documents in a specific library using BM25 ranking (v2 documents by default)
 *
 * @param params - Search parameters
 * @param params.libraryId - Target library identifier
 * @param params.keywords - Search keywords
 * @param params.searchMode - Search mode (broad/balanced/precise)
 * @param params.maxTokens - Maximum tokens in response
 * @returns Search results or error
 *
 * @example
 * ```typescript
 * const result = await getDocuments({
 *   libraryId: "tosspayments",
 *   keywords: ["결제", "카드"],
 *   searchMode: "balanced",
 *   maxTokens: 25000
 * });
 * ```
 */
export async function getDocuments(
  params: GetDocumentParams
): Promise<CallToolResult> {
  try {
    const { libraryId, keywords, searchMode, maxTokens = 25000 } = params;

    // Get or create repository for this library
    const repository = await repositoryManager.getRepository(libraryId);

    // Search v2 documents (default behavior)
    const text = await repository.findV2DocumentsByKeyword(
      keywords,
      searchMode,
      maxTokens
    );

    return {
      content: [{ type: "text", text }],
    };
  } catch (e) {
    if (e instanceof LibraryNotFoundError) {
      return {
        content: [
          {
            type: "text",
            text: `${e.message}\n\nUse 'get-library-list' to see available libraries.`,
          },
        ],
        isError: true,
      };
    }

    if (e instanceof LibraryInitializationError) {
      return {
        content: [
          {
            type: "text",
            text: `Unable to access library '${e.libraryId}': ${e.cause.message}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: isNativeError(e) ? e.message : "An error occurred.",
        },
      ],
      isError: true,
    };
  }
}

/**
 * Get full document content by ID from a specific library
 *
 * @param params - Parameters including libraryId and document ID
 * @param params.libraryId - Target library identifier
 * @param params.id - Document ID
 * @returns Complete document content or error
 *
 * @example
 * ```typescript
 * const result = await getDocumentById({
 *   libraryId: "tosspayments",
 *   id: "42"
 * });
 * ```
 */
export async function getDocumentById(
  params: DocumentByIdParams
): Promise<CallToolResult> {
  try {
    const { libraryId, id } = params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      throw new Error("Invalid document ID.");
    }

    // Get repository for this library
    const repository = await repositoryManager.getRepository(libraryId);

    const document = repository.findOneById(numericId);

    if (!document) {
      throw new Error(
        `Document not found. (Library: ${libraryId}, ID: ${id})`
      );
    }

    const chunks = document.getChunks();

    const contents = chunks.map((chunk): { type: "text"; text: string } => ({
      type: "text",
      text: chunk.text,
    }));

    return {
      content: contents,
    };
  } catch (e) {
    if (e instanceof LibraryNotFoundError) {
      return {
        content: [
          {
            type: "text",
            text: `${e.message}\n\nUse 'get-library-list' to see available libraries.`,
          },
        ],
        isError: true,
      };
    }

    if (e instanceof LibraryInitializationError) {
      return {
        content: [
          {
            type: "text",
            text: `Unable to access library '${e.libraryId}': ${e.cause.message}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: isNativeError(e) ? e.message : "An error occurred.",
        },
      ],
      isError: true,
    };
  }
}
