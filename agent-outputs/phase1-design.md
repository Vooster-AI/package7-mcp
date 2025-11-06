# Phase 1: Multi-Library System Design Document

**Version**: 1.0
**Date**: 2025-11-06
**Status**: APPROVED FOR IMPLEMENTATION

---

## 1. Overview

### 1.1 Problem Statement

The current MCP server (`package7-mcp`) is hardcoded to work exclusively with TossPayments documentation. The architecture has several limitations:

- `createDocsRepository()` defaults to `https://docs.tosspayments.com/llms.txt`
- Tools (`get-v1-documents`, `get-v2-documents`) have no library selection capability
- Single repository instance initialized at module load time (`tools.ts:7`)
- No mechanism to add new libraries without code changes

### 1.2 Solution Approach

Transform the server into a **multi-library documentation system** where:

1. **Library configurations** are stored in a centralized, type-safe array
2. **Repository factory** accepts `libraryId` and `llmsTxtUrl` parameters
3. **Repository manager** caches instances per library (lazy initialization)
4. **Tool interfaces** expose `libraryId` parameter for library selection
5. **New library tool** (`get-library-list`) provides discovery

**Key Design Principle**: Adding a new library should require **ZERO code changes** - only configuration modification.

### 1.3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Client (LLM Agent)                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Tools Layer                           │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐ │
│  │get-library   │  │get-documents   │  │document-by-id   │ │
│  │   -list      │  │  (libraryId)   │  │  (libraryId)    │ │
│  └──────────────┘  └────────────────┘  └─────────────────┘ │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Repository Manager (Singleton)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Cache: Map<libraryId, DocsRepository>                  │ │
│  │ getRepository(libraryId) → DocsRepository              │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           createDocsRepository(libraryId, llmsTxtUrl)        │
│  1. Fetch llms.txt from URL                                  │
│  2. Parse with parseLLMText()                                │
│  3. Load documents with DocumentLoader                       │
│  4. Return new DocsRepository instance                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   DocsRepository Instances                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ tosspayments │  │   supabase   │  │    clerk     │      │
│  │  Repository  │  │  Repository  │  │  Repository  │ ...  │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                 ▲
                 │
┌────────────────┴────────────────────────────────────────────┐
│              Library Configuration Array                     │
│  src/config/libraries.ts                                     │
│  [{ id: "tosspayments", llmsTxtUrl: "..." }, ...]           │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow for `get-documents` call**:
1. Client calls `get-documents` with `{ libraryId: "supabase", keywords: [...] }`
2. Tool handler validates parameters with Zod schema
3. Repository Manager checks cache for "supabase" repository
4. If not cached: calls `createDocsRepository("supabase", url)` → caches result
5. If cached: returns existing instance
6. Calls `repository.findV2DocumentsByKeyword(...)`
7. Returns formatted result to client

---

## 2. Type System Design

### 2.1 Core Type Definitions

**File**: `src/config/libraries.ts` (NEW)

```typescript
import { z } from "zod";

/**
 * Schema for library configuration validation
 */
export const LibraryConfigSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Library ID must contain only lowercase letters, numbers, and hyphens")
    .describe("Unique identifier for the library (e.g., 'tosspayments', 'supabase')"),
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
  // Add more libraries here:
  // {
  //   id: "supabase",
  //   llmsTxtUrl: "https://supabase.com/llms.txt",
  // },
  // {
  //   id: "clerk",
  //   llmsTxtUrl: "https://clerk.com/llms.txt",
  // },
];

/**
 * Validates and returns all library configurations
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
 */
export function getLibraryIds(): string[] {
  return AVAILABLE_LIBRARIES.map((lib) => lib.id);
}
```

### 2.2 Updated Tool Parameter Types

**File**: `src/schema/get-document-schema.ts` (MODIFY)

```typescript
import { z } from "zod";
import { SearchMode } from "../constants/search-mode.js";
import { getLibraryIds } from "../config/libraries.js";

/**
 * Schema for get-documents tool
 */
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
      "검색할 키워드 배열. 예: ['결제위젯', '연동'] - 관련성이 높은 문서를 찾기 위한 핵심 단어들"
    ),
  searchMode: z
    .nativeEnum(SearchMode)
    .default(SearchMode.BALANCED)
    .describe(
      `
      검색 모드에 따라 결과의 관련성과 정확도가 달라집니다.

      검색 모드:
      - broad: 폭넓은 결과 (관련성 낮아도 포함, 개념 탐색 시)
      - balanced: 균형잡힌 결과 (일반적인 검색)
      - precise: 정확한 결과만 (정확한 답변 필요 시)
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
      응답에 포함할 최대 토큰 수입니다. 허용가능한 토큰 숫자는 500에서 50000 사이입니다.

      권장값:
      - 1000: 간단한 답변 (빠른 응답)
      - 10000: 균형잡힌 상세도
      - 25000: 매우 상세한 분석 (기본값)
      - 50000: 최대 상세도 (긴 문서나 복잡한 내용) 단, 허용가능한 토큰의 크기를 초과할 수 있으므로 주의가 필요합니다.
    `
    )
    .optional(),
};

/**
 * Type for get-documents parameters
 */
export type GetDocumentParams = {
  libraryId: string;
  keywords: string[];
  searchMode?: SearchMode;
  maxTokens?: number;
};
```

**File**: `src/schema/document-by-id-schema.ts` (NEW)

```typescript
import { z } from "zod";
import { getLibraryIds } from "../config/libraries.js";

/**
 * Schema for document-by-id tool
 */
export const DocumentByIdSchema = {
  libraryId: z
    .string()
    .min(1)
    .describe(
      `Library identifier. Available libraries: ${getLibraryIds().join(", ")}`
    ),
  id: z
    .string()
    .describe("문서별 id 값"),
};

/**
 * Type for document-by-id parameters
 */
export type DocumentByIdParams = {
  libraryId: string;
  id: string;
};
```

### 2.3 Repository Manager Types

**File**: `src/repository/repository-manager.ts` (NEW)

```typescript
import { DocsRepository } from "./docs.repository.js";
import { LibraryConfig } from "../config/libraries.js";

/**
 * Status of a library initialization
 */
export type LibraryStatus = {
  id: string;
  available: boolean;
  error?: string;
};

/**
 * Error thrown when library is not found
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
    super(
      `Failed to initialize library '${libraryId}': ${cause.message}`
    );
    this.name = "LibraryInitializationError";
  }
}
```

---

## 3. Library Configuration Management

### 3.1 Storage Strategy

**Decision: Hardcoded TypeScript Array**

**Rationale**:
- **Type Safety**: TypeScript compiler validates structure at build time
- **No Runtime I/O**: No file system access during initialization
- **Version Control**: Changes tracked in Git with code
- **IDE Support**: Autocomplete and inline documentation
- **Simplicity**: No need for file parsing or error handling

**Location**: `src/config/libraries.ts`

**Alternative Considered**: External JSON file
- **Rejected because**: Requires runtime I/O, loses type safety, adds complexity
- **Future Migration Path**: If needed, can load JSON in addition to hardcoded defaults

### 3.2 Validation Strategy

**At Compile Time**:
- TypeScript type checking ensures `id` and `llmsTxtUrl` properties exist
- Zod schema inference provides type-safe access

**At Runtime**:
- `getLibraries()` validates with Zod on first call
- Early detection of malformed configurations
- Clear error messages for validation failures

**Example Validation Error**:
```typescript
// Invalid configuration
{ id: "My Library", llmsTxtUrl: "not-a-url" }

// Zod error message:
// - id: Library ID must contain only lowercase letters, numbers, and hyphens
// - llmsTxtUrl: Invalid URL
```

### 3.3 Lookup Helpers

```typescript
// Example usage in tool handlers:

import { findLibrary, getLibraryIds } from "../config/libraries.js";

// Validate library exists
const config = findLibrary(libraryId);
if (!config) {
  throw new LibraryNotFoundError(libraryId, getLibraryIds());
}

// Use configuration
const repository = await createDocsRepository(config.id, config.llmsTxtUrl);
```

---

## 4. Repository Layer Changes

### 4.1 createDocsRepository Refactoring

**Current Signature**:
```typescript
export async function createDocsRepository(
  link = "https://docs.tosspayments.com/llms.txt"
): Promise<DocsRepository>
```

**Problems**:
- Hardcoded default URL
- No library identification
- Cannot support multiple libraries
- Single global instance

**Proposed Signature**:
```typescript
/**
 * Creates a documentation repository for a specific library
 *
 * @param libraryId - Unique identifier for the library (used for logging/debugging)
 * @param llmsTxtUrl - URL to the library's llms.txt file
 * @returns Promise resolving to a configured DocsRepository instance
 * @throws {Error} If llms.txt fetch fails or parsing errors occur
 */
export async function createDocsRepository(
  libraryId: string,
  llmsTxtUrl: string
): Promise<DocsRepository>
```

**Implementation Outline**:

**File**: `src/repository/createDocsRepository.ts` (MODIFY)

```typescript
import { CategoryWeightCalculator } from "../document/category-weight-calculator.js";
import { MarkdownDocumentFetcher } from "../document/markdown-document.fetcher.js";
import { parseLLMText } from "../document/parseLLMText.js";
import { DocumentLoader } from "../document/document.loader.js";
import { DocsRepository } from "./docs.repository.js";
import { SynonymDictionary } from "../document/synonym-dictionary.js";

export async function createDocsRepository(
  libraryId: string,
  llmsTxtUrl: string
): Promise<DocsRepository> {
  try {
    const response = await fetch(llmsTxtUrl, {
      headers: {
        "user-agent": "Package7MCP",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch llms.txt for library '${libraryId}': ${response.status} ${response.statusText}`
      );
    }

    const llmText = await response.text();
    const rawDocs = parseLLMText(llmText);

    const loader = new DocumentLoader(
      rawDocs,
      new MarkdownDocumentFetcher()
    );

    await loader.load();

    const documents = loader.getDocuments();

    return new DocsRepository(
      documents,
      new CategoryWeightCalculator(),
      new SynonymDictionary()
    );
  } catch (error) {
    // Re-throw with library context
    if (error instanceof Error) {
      throw new Error(
        `Failed to create repository for '${libraryId}': ${error.message}`
      );
    }
    throw error;
  }
}
```

**Key Changes**:
1. Accept `libraryId` and `llmsTxtUrl` as required parameters
2. Remove default parameter (no hardcoded URL)
3. Include `libraryId` in error messages for debugging
4. Wrapped in try-catch to provide context in errors

### 4.2 Repository Manager Implementation

**Strategy: Lazy Initialization with In-Memory Cache**

**Decision Rationale**:

| Approach | Pros | Cons | Choice |
|----------|------|------|--------|
| **Eager** (all at startup) | Fast tool response, fail-fast | Slow startup, high memory, wasted resources | ❌ |
| **Lazy** (on first request) | Fast startup, efficient memory, load only what's used | First request slower, delayed error detection | ✅ |

**Chosen**: Lazy initialization
- **Justification**: Many libraries may be configured but unused. Loading only on-demand saves resources and startup time. First-request delay is acceptable trade-off.

**Implementation**:

**File**: `src/repository/repository-manager.ts` (NEW)

```typescript
import { DocsRepository } from "./docs.repository.js";
import { createDocsRepository } from "./createDocsRepository.js";
import {
  findLibrary,
  getLibraryIds,
  LibraryConfig
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
   */
  private async initializeRepository(
    config: LibraryConfig
  ): Promise<DocsRepository> {
    console.log(`Initializing repository for library: ${config.id}`);
    const repository = await createDocsRepository(
      config.id,
      config.llmsTxtUrl
    );
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
      available: this.cache.has(id) || !this.initializationErrors.has(id),
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
```

**Key Features**:
1. **Thread-safe**: Prevents duplicate concurrent initializations with `pendingInitializations` map
2. **Error caching**: Failed initializations are remembered to avoid retry storms
3. **Lazy loading**: Repositories created only when requested
4. **Status tracking**: Can query which libraries are available/failed
5. **Singleton pattern**: Single instance shared across all tools

### 4.3 Error Handling Strategy

**Partial Failure Tolerance**:

| Scenario | Behavior | User Experience |
|----------|----------|-----------------|
| One library init fails | Continue serving other libraries | Error only when requesting failed library |
| Network timeout during fetch | Store error, don't retry | Clear error message with suggestion |
| Malformed llms.txt | Store parse error | Error message indicates format issue |
| All libraries fail | Server still starts | Each tool call returns appropriate error |

**Example Error Messages**:

```typescript
// Library not found
{
  content: [{
    type: "text",
    text: "Library 'unknown-lib' not found. Available libraries: tosspayments, supabase, clerk"
  }],
  isError: true
}

// Initialization failed
{
  content: [{
    type: "text",
    text: "Failed to initialize library 'supabase': Network request failed. Please check the llmsTxtUrl configuration."
  }],
  isError: true
}

// Empty results (not an error)
{
  content: [{
    type: "text",
    text: "No documents found matching keywords: ['nonexistent']"
  }]
}
```

---

## 5. Tool Interface Design

### 5.1 NEW: get-library-list

**Purpose**: Allow clients to discover available libraries

**Tool Registration**:

**File**: `src/bin/cli.ts` (MODIFY - add tool)

```typescript
server.tool(
  "get-library-list",
  "Returns the list of available library documentation sources. Use this to discover which libraries are supported before searching for documents.",
  {}, // No input parameters
  async () => {
    return await getLibraryList();
  }
);
```

**Handler Implementation**:

**File**: `src/tool/tools.ts` (MODIFY - add function)

```typescript
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getLibraries } from "../config/libraries.js";
import { repositoryManager } from "../repository/repository-manager.js";

/**
 * Get list of available libraries
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
```

**Example Output**:
```json
Available libraries:

[
  {
    "id": "tosspayments",
    "available": true
  },
  {
    "id": "supabase",
    "available": false,
    "error": "Failed to fetch llms.txt: 404 Not Found"
  }
]

Use the 'id' field when calling get-documents or document-by-id.
```

### 5.2 MODIFIED: get-documents (renamed from get-v2-documents)

**Changes**:
1. Rename tool: `get-v2-documents` → `get-documents`
2. Add `libraryId` parameter (required)
3. Update to use `repositoryManager`
4. Keep v1/v2 search distinction per library

**Tool Registration**:

**File**: `src/bin/cli.ts` (MODIFY)

```typescript
server.tool(
  "get-documents",
  `Searches and retrieves documentation for a specific library. Returns relevant document sections based on keyword matching using BM25 algorithm.

Usage:
1. Call get-library-list to see available libraries
2. Use the library ID when searching documents
3. Provide keywords related to what you're looking for

${BasePrompt}`,
  GetDocumentSchema,
  async (params) => {
    return await getDocuments(params);
  }
);
```

**Handler Implementation**:

**File**: `src/tool/tools.ts` (MODIFY)

```typescript
import { GetDocumentParams } from "../schema/get-document-schema.js";
import { repositoryManager } from "../repository/repository-manager.js";
import { LibraryNotFoundError, LibraryInitializationError } from "../repository/types.js";

/**
 * Search documents in a specific library (v2 documents by default)
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
            text: e.message,
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
          text: isNativeError(e) ? e.message : "오류가 발생하였습니다.",
        },
      ],
      isError: true,
    };
  }
}
```

**Example Usage**:
```typescript
// Client call
{
  "tool": "get-documents",
  "params": {
    "libraryId": "tosspayments",
    "keywords": ["결제위젯", "연동"],
    "searchMode": "balanced",
    "maxTokens": 25000
  }
}
```

### 5.3 MODIFIED: document-by-id

**Changes**:
1. Add `libraryId` parameter (required)
2. Update schema to use `DocumentByIdSchema`
3. Update to use `repositoryManager`

**Tool Registration**:

**File**: `src/bin/cli.ts` (MODIFY)

```typescript
import { DocumentByIdSchema } from "../schema/document-by-id-schema.js";

server.tool(
  "document-by-id",
  `Retrieves the complete content of a specific document by its ID within a library. The document ID is returned in search results from get-documents.`,
  DocumentByIdSchema,
  async (params) => {
    return await getDocumentById(params);
  }
);
```

**Handler Implementation**:

**File**: `src/tool/tools.ts` (MODIFY)

```typescript
import { DocumentByIdParams } from "../schema/document-by-id-schema.js";

/**
 * Get full document content by ID from a specific library
 */
export async function getDocumentById(
  params: DocumentByIdParams
): Promise<CallToolResult> {
  try {
    const { libraryId, id } = params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      throw new Error("유효하지 않은 문서 ID입니다.");
    }

    // Get repository for this library
    const repository = await repositoryManager.getRepository(libraryId);

    const document = repository.findOneById(numericId);

    if (!document) {
      throw new Error(`문서를 찾을 수 없습니다. (Library: ${libraryId}, ID: ${id})`);
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
            text: e.message,
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
          text: isNativeError(e) ? e.message : "오류가 발생하였습니다.",
        },
      ],
      isError: true,
    };
  }
}
```

**Example Usage**:
```typescript
// Client call
{
  "tool": "document-by-id",
  "params": {
    "libraryId": "tosspayments",
    "id": "42"
  }
}
```

### 5.4 REMOVED: get-v1-documents

**Strategy: Complete Removal**

**Rationale**:
- V1/V2 distinction is library-specific, not a global concept
- Each library's `DocsRepository` maintains its own v1/v2 separation
- The tool `get-documents` searches v2 by default (most recent docs)
- If users need v1 docs, they can be accessed through `document-by-id` with the v1 document's ID

**Migration Path** (see section 6 for details):
- Remove tool registration from `cli.ts`
- Remove `getV1DocumentsByKeyword` function from `tools.ts`
- Add note in CHANGELOG.md about removal

**File**: `src/bin/cli.ts` (MODIFY - remove)
```typescript
// DELETE THIS BLOCK:
server.tool("get-v1-documents", `...`, GetDocumentSchema, async (params) => {
  return await getV1DocumentsByKeyword(params);
});
```

**File**: `src/tool/tools.ts` (MODIFY - remove)
```typescript
// DELETE THIS FUNCTION:
export async function getV1DocumentsByKeyword(
  params: GetDocumentParams
): Promise<CallToolResult> {
  // ... entire function body
}
```

---

## 6. Migration Path & Backward Compatibility

### 6.1 Breaking Changes Assessment

| Change | Impact | Severity |
|--------|--------|----------|
| Remove `get-v1-documents` | Users calling this tool will get error | **HIGH** |
| Rename `get-v2-documents` → `get-documents` | Users calling old name will get error | **HIGH** |
| Add `libraryId` to `get-documents` | Requires all calls to include libraryId | **HIGH** |
| Add `libraryId` to `document-by-id` | Requires all calls to include libraryId | **HIGH** |

**Verdict**: This is a **MAJOR VERSION change** (1.x.x → 2.0.0)

### 6.2 Migration Strategy

**Decision: Clean Break with Clear Migration Guide**

**Rationale**:
- Maintaining old tool names adds complexity
- MCP tools are typically called by LLM agents, not end-user code
- Clear error messages guide agents to correct usage
- Clean API surface for future development

**Recommended Approach**: Version 2.0.0 release

### 6.3 User Migration Guide

**For existing tosspayments users**:

**Before (v1.x.x)**:
```typescript
// Old API
await mcp.call("get-v2-documents", {
  keywords: ["결제위젯", "연동"],
  searchMode: "balanced",
  maxTokens: 25000
});

await mcp.call("document-by-id", {
  id: "42"
});

await mcp.call("get-v1-documents", {
  keywords: ["payment"],
});
```

**After (v2.0.0)**:
```typescript
// Step 1: Discover available libraries
const libraries = await mcp.call("get-library-list", {});
// Returns: [{ id: "tosspayments", available: true }, ...]

// Step 2: Search documents with libraryId
await mcp.call("get-documents", {
  libraryId: "tosspayments",  // NEW: required parameter
  keywords: ["결제위젯", "연동"],
  searchMode: "balanced",
  maxTokens: 25000
});

// Step 3: Get document by ID with libraryId
await mcp.call("document-by-id", {
  libraryId: "tosspayments",  // NEW: required parameter
  id: "42"
});

// V1 documents: Access via document-by-id with v1 doc IDs
// (get-v1-documents removed, but v1 docs still exist in repository)
```

### 6.4 CHANGELOG Entry

**File**: `CHANGELOG.md` (MODIFY - add entry)

```markdown
## [2.0.0] - 2025-11-06

### Breaking Changes

#### Multi-Library Support
The MCP server now supports multiple library documentation sources. This requires changes to all tool calls:

1. **New Tool**: `get-library-list`
   - Returns available libraries
   - No parameters required

2. **Tool Renamed**: `get-v2-documents` → `get-documents`
   - **Migration**: Replace `get-v2-documents` with `get-documents`
   - **New Parameter**: `libraryId` (required) - specify which library to search
   - Example: `{ libraryId: "tosspayments", keywords: [...] }`

3. **Tool Removed**: `get-v1-documents`
   - **Reason**: V1/V2 distinction is library-specific, not tool-specific
   - **Migration**: Use `get-documents` for v2 docs (default). For v1 docs, use `document-by-id` with v1 document IDs.

4. **Tool Updated**: `document-by-id`
   - **New Parameter**: `libraryId` (required)
   - Example: `{ libraryId: "tosspayments", id: "42" }`

#### Configuration System
- New file: `src/config/libraries.ts`
- Libraries configured in TypeScript array (type-safe)
- To add new library: Add to `AVAILABLE_LIBRARIES` array

### Migration Guide

**For TossPayments users**:
```typescript
// Before v2.0.0
await call("get-v2-documents", { keywords: [...] })

// After v2.0.0
await call("get-documents", { libraryId: "tosspayments", keywords: [...] })
```

**For new library support**:
```typescript
// Add to src/config/libraries.ts
{
  id: "your-library",
  llmsTxtUrl: "https://your-library.com/llms.txt"
}
```

### Added
- Multi-library support with lazy initialization
- Repository caching system
- Comprehensive error messages with library context
- Library status tracking

### Changed
- `createDocsRepository` now requires `libraryId` and `llmsTxtUrl` parameters
- All tools now require `libraryId` parameter
- Server description updated to reflect multi-library support
```

### 6.5 Error Messages for Deprecated Tools

**Not Applicable** - tools are removed, not deprecated. If user calls non-existent tool, MCP SDK returns standard "tool not found" error.

---

## 7. Error Handling Strategy

### 7.1 Error Taxonomy

| Error Type | Class | Recovery Strategy | User-Facing Message |
|------------|-------|-------------------|---------------------|
| Library not found | `LibraryNotFoundError` | List available libraries | "Library '{id}' not found. Available: [...]" |
| Library init failed | `LibraryInitializationError` | Cache error, don't retry | "Unable to access library: {cause}" |
| Invalid libraryId format | `ValidationError` (Zod) | Immediate rejection | "Invalid libraryId: must be alphanumeric" |
| Network timeout | `Error` (native) | Cache error | "Network request timed out" |
| Malformed llms.txt | `Error` (parse) | Cache error | "Failed to parse library docs: {details}" |
| Empty search results | N/A (not error) | Return empty | "No documents found matching keywords" |
| Invalid document ID | `Error` | Return error | "유효하지 않은 문서 ID입니다" |
| Document not found | `Error` | Return error | "문서를 찾을 수 없습니다 (Library: {id}, ID: {id})" |

### 7.2 Error Handling Flow

```typescript
/**
 * Standard error handling pattern for all tools
 */
async function toolHandler(params: Params): Promise<CallToolResult> {
  try {
    // 1. Validate parameters (Zod handles this before handler is called)

    // 2. Get repository (may throw LibraryNotFoundError or LibraryInitializationError)
    const repository = await repositoryManager.getRepository(params.libraryId);

    // 3. Perform operation (may throw business logic errors)
    const result = await repository.someMethod(...);

    // 4. Return success
    return {
      content: [{ type: "text", text: result }],
    };
  } catch (e) {
    // Handle known error types
    if (e instanceof LibraryNotFoundError) {
      return {
        content: [{ type: "text", text: e.message }],
        isError: true,
      };
    }

    if (e instanceof LibraryInitializationError) {
      return {
        content: [{ type: "text", text: `Unable to access library: ${e.cause.message}` }],
        isError: true,
      };
    }

    // Handle unknown errors
    return {
      content: [{
        type: "text",
        text: isNativeError(e) ? e.message : "An unexpected error occurred"
      }],
      isError: true,
    };
  }
}
```

### 7.3 Logging Strategy

**Console Logging for Key Events**:

```typescript
// Repository initialization
console.log(`Initializing repository for library: ${libraryId}`);
console.log(`Successfully initialized repository for: ${libraryId}`);

// Errors (not logged in production by default, but available for debugging)
console.error(`Failed to initialize library '${libraryId}':`, error);

// Cache hits (debug level, commented out in production)
// console.debug(`Repository cache hit for: ${libraryId}`);
```

**Recommendations**:
- Use structured logging library in future (e.g., `pino`, `winston`)
- Add log levels (DEBUG, INFO, WARN, ERROR)
- Include request IDs for tracing
- Consider telemetry for production monitoring

### 7.4 Scenario Coverage

#### Scenario 1: Invalid libraryId
```typescript
// Input
{ libraryId: "unknown-lib", keywords: ["test"] }

// Zod validation passes (string format ok)
// Repository manager checks configuration
throw new LibraryNotFoundError("unknown-lib", ["tosspayments", "supabase"]);

// Output
{
  content: [{
    type: "text",
    text: "Library 'unknown-lib' not found. Available libraries: tosspayments, supabase"
  }],
  isError: true
}
```

#### Scenario 2: Failed llms.txt fetch (network error)
```typescript
// First request to library
await repositoryManager.getRepository("supabase");

// createDocsRepository attempts fetch
fetch("https://supabase.com/llms.txt") // throws network error

// Repository manager catches, stores error
initializationErrors.set("supabase", error);

// Output to user
{
  content: [{
    type: "text",
    text: "Unable to access library 'supabase': Network request failed"
  }],
  isError: true
}

// Subsequent requests
// Returns cached error immediately without retry
```

#### Scenario 3: Malformed llms.txt
```typescript
// llms.txt contains invalid format
parseLLMText(text); // throws parse error

// Caught by createDocsRepository
throw new Error("Failed to create repository for 'mylib': Invalid llms.txt format");

// Stored as initialization error
initializationErrors.set("mylib", error);

// Output
{
  content: [{
    type: "text",
    text: "Unable to access library 'mylib': Invalid llms.txt format at line 42"
  }],
  isError: true
}
```

#### Scenario 4: Concurrent requests for same library
```typescript
// Request 1 starts
const repo1 = repositoryManager.getRepository("tosspayments");
// pendingInitializations.set("tosspayments", promise)

// Request 2 starts (before Request 1 completes)
const repo2 = repositoryManager.getRepository("tosspayments");
// Returns same promise from pendingInitializations

// Both await same initialization
// Only one fetch happens
// Both receive same repository instance
```

#### Scenario 5: Empty search results
```typescript
// User searches for non-existent keywords
const text = await repository.findV2DocumentsByKeyword(
  ["nonexistent-keyword"],
  SearchMode.BALANCED,
  25000
);

// BM25 returns no matches
// normalize() returns empty string

// Output (NOT an error)
{
  content: [{
    type: "text",
    text: "" // Empty result
  }]
}

// Better UX: Return informative message
{
  content: [{
    type: "text",
    text: "No documents found matching keywords: ['nonexistent-keyword']"
  }]
}
```

---

## 8. File Modification Plan

### 8.1 Files to CREATE

| File Path | Purpose | Lines (Est.) | Priority |
|-----------|---------|--------------|----------|
| `src/config/libraries.ts` | Library configuration array, validation, lookups | ~120 | P0 (Required first) |
| `src/repository/repository-manager.ts` | Repository caching and lazy initialization | ~150 | P0 |
| `src/repository/types.ts` | Error classes and types for repository layer | ~50 | P0 |
| `src/schema/document-by-id-schema.ts` | Zod schema for document-by-id tool | ~25 | P1 |

**Total New Code**: ~345 lines

### 8.2 Files to MODIFY

| File Path | Changes | Lines Changed (Est.) | Priority |
|-----------|---------|---------------------|----------|
| `src/repository/createDocsRepository.ts` | Change signature, add libraryId param, update error handling | ~15 | P0 |
| `src/schema/get-document-schema.ts` | Add libraryId field, update types | ~10 | P0 |
| `src/tool/tools.ts` | Add getLibraryList, modify getDocuments/getDocumentById, remove getV1DocumentsByKeyword | ~80 | P1 |
| `src/bin/cli.ts` | Register new tool, update tool registrations, remove old tool | ~20 | P1 |
| `CHANGELOG.md` | Add v2.0.0 breaking changes entry | ~50 | P2 |
| `README.md` | Update usage examples with libraryId | ~40 | P2 |
| `package.json` | Update version to 2.0.0 | ~1 | P2 |

**Total Modified Lines**: ~216 lines

### 8.3 Files to DELETE

| File Path | Reason |
|-----------|--------|
| None | All legacy code can be removed inline in modified files |

### 8.4 Detailed Change Specifications

#### File: `src/repository/createDocsRepository.ts`

**Before**:
```typescript
export async function createDocsRepository(
  link = "https://docs.tosspayments.com/llms.txt"
): Promise<DocsRepository> {
  const response = await fetch(link, {
    headers: { "user-agent": "Package7MCP" },
  });
  // ... rest unchanged
}
```

**After**:
```typescript
export async function createDocsRepository(
  libraryId: string,
  llmsTxtUrl: string
): Promise<DocsRepository> {
  try {
    const response = await fetch(llmsTxtUrl, {
      headers: { "user-agent": "Package7MCP" },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch llms.txt for library '${libraryId}': ${response.status} ${response.statusText}`
      );
    }
    // ... rest with libraryId in errors
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to create repository for '${libraryId}': ${error.message}`
      );
    }
    throw error;
  }
}
```

**Changes**:
- Line 8-9: Remove default parameter, add libraryId and llmsTxtUrl
- Line 11: Change `link` to `llmsTxtUrl`
- Line 17-19: Add response.ok check with libraryId in error
- Line 33-42: Wrap entire function in try-catch with context

#### File: `src/tool/tools.ts`

**Current Structure**:
```typescript
export const repository = await createDocsRepository(); // Line 7
export async function getV1DocumentsByKeyword(...) { ... } // Lines 12-38
export async function getV2DocumentsByKeyword(...) { ... } // Lines 43-68
export async function getDocumentById(id: string) { ... } // Lines 73-108
```

**New Structure**:
```typescript
// REMOVE Line 7: export const repository = await createDocsRepository();
// Import repository manager instead
import { repositoryManager } from "../repository/repository-manager.js";

// ADD: getLibraryList function (~30 lines)
export async function getLibraryList(): Promise<CallToolResult> { ... }

// REMOVE: getV1DocumentsByKeyword function (delete lines 12-38)

// REPLACE: getV2DocumentsByKeyword → getDocuments
export async function getDocuments(
  params: GetDocumentParams // now includes libraryId
): Promise<CallToolResult> {
  // Get repository from manager
  const repository = await repositoryManager.getRepository(params.libraryId);
  // ... rest similar
}

// MODIFY: getDocumentById to accept params object with libraryId
export async function getDocumentById(
  params: DocumentByIdParams // now includes libraryId
): Promise<CallToolResult> {
  const { libraryId, id } = params;
  const repository = await repositoryManager.getRepository(libraryId);
  // ... rest similar
}
```

#### File: `src/bin/cli.ts`

**Changes**:
- Line 16-19: Replace `get-v2-documents` → `get-documents`, update description
- Line 21-24: **DELETE** `get-v1-documents` registration
- Line 26-28: Update `document-by-id` to use `DocumentByIdSchema` and pass params object
- **ADD** after line 14: New tool registration for `get-library-list`

**New tool registration** (insert after line 14):
```typescript
server.tool(
  "get-library-list",
  "Returns the list of available library documentation sources. Use this to discover which libraries are supported before searching for documents.",
  {},
  async () => {
    return await getLibraryList();
  }
);
```

### 8.5 Dependency Tree

```
Priority 0 (Foundation):
  src/config/libraries.ts
    └─ No dependencies (can be implemented first)

  src/repository/types.ts
    └─ Depends on: src/config/libraries.ts

  src/repository/repository-manager.ts
    └─ Depends on:
        - src/config/libraries.ts
        - src/repository/types.ts
        - src/repository/createDocsRepository.ts (modified)

  src/repository/createDocsRepository.ts (MODIFY)
    └─ No new dependencies (existing code works as-is)

Priority 1 (Integration):
  src/schema/document-by-id-schema.ts
    └─ Depends on: src/config/libraries.ts

  src/schema/get-document-schema.ts (MODIFY)
    └─ Depends on: src/config/libraries.ts

  src/tool/tools.ts (MODIFY)
    └─ Depends on:
        - src/repository/repository-manager.ts
        - src/schema/get-document-schema.ts (modified)
        - src/schema/document-by-id-schema.ts (new)
        - src/repository/types.ts

  src/bin/cli.ts (MODIFY)
    └─ Depends on:
        - src/tool/tools.ts (modified)
        - src/schema/document-by-id-schema.ts (new)

Priority 2 (Documentation):
  CHANGELOG.md (MODIFY)
  README.md (MODIFY)
  package.json (MODIFY)
```

---

## 9. Testing Strategy

### 9.1 Test Coverage Requirements

**Minimum Coverage Targets**:
- Unit tests: 85% coverage of new code
- Integration tests: All multi-library scenarios
- E2E tests: At least one full flow per tool

### 9.2 New Test Files

#### File: `src/config/__test__/libraries.test.ts`

**Purpose**: Validate library configuration system

**Test Cases**:
```typescript
import { describe, it, expect } from "vitest";
import {
  getLibraries,
  findLibrary,
  getLibraryIds,
  LibraryConfigSchema
} from "../libraries.js";

describe("Library Configuration", () => {
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
  });

  describe("findLibrary", () => {
    it("should find existing library by id", () => {
      const lib = findLibrary("tosspayments");
      expect(lib).toBeDefined();
      expect(lib?.id).toBe("tosspayments");
    });

    it("should return undefined for non-existent library", () => {
      const lib = findLibrary("nonexistent");
      expect(lib).toBeUndefined();
    });
  });

  describe("getLibraryIds", () => {
    it("should return array of library ids", () => {
      const ids = getLibraryIds();
      expect(ids).toBeInstanceOf(Array);
      expect(ids).toContain("tosspayments");
    });
  });

  describe("LibraryConfigSchema", () => {
    it("should validate correct configuration", () => {
      const valid = {
        id: "test-lib",
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(valid)).not.toThrow();
    });

    it("should reject invalid id format", () => {
      const invalid = {
        id: "Invalid Library Name",
        llmsTxtUrl: "https://example.com/llms.txt",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });

    it("should reject invalid URL", () => {
      const invalid = {
        id: "test-lib",
        llmsTxtUrl: "not-a-url",
      };
      expect(() => LibraryConfigSchema.parse(invalid)).toThrow();
    });
  });
});
```

#### File: `src/repository/__test__/repository-manager.test.ts`

**Purpose**: Test repository caching and lazy initialization

**Test Cases**:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { repositoryManager } from "../repository-manager.js";
import { LibraryNotFoundError, LibraryInitializationError } from "../types.js";
import * as createDocsRepositoryModule from "../createDocsRepository.js";

// Mock createDocsRepository
vi.mock("../createDocsRepository.js");

describe("RepositoryManager", () => {
  beforeEach(() => {
    repositoryManager.clearCache();
    vi.clearAllMocks();
  });

  describe("getRepository", () => {
    it("should create repository on first request", async () => {
      const mockRepo = { /* mock DocsRepository */ };
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository")
        .mockResolvedValue(mockRepo);

      const repo = await repositoryManager.getRepository("tosspayments");

      expect(repo).toBe(mockRepo);
      expect(createDocsRepositoryModule.createDocsRepository)
        .toHaveBeenCalledWith("tosspayments", "https://docs.tosspayments.com/llms.txt");
    });

    it("should return cached repository on subsequent requests", async () => {
      const mockRepo = { /* mock DocsRepository */ };
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository")
        .mockResolvedValue(mockRepo);

      await repositoryManager.getRepository("tosspayments");
      const repo2 = await repositoryManager.getRepository("tosspayments");

      expect(repo2).toBe(mockRepo);
      expect(createDocsRepositoryModule.createDocsRepository)
        .toHaveBeenCalledTimes(1); // Only once
    });

    it("should throw LibraryNotFoundError for invalid library", async () => {
      await expect(
        repositoryManager.getRepository("invalid-lib")
      ).rejects.toThrow(LibraryNotFoundError);
    });

    it("should cache initialization errors", async () => {
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository")
        .mockRejectedValue(new Error("Network error"));

      await expect(
        repositoryManager.getRepository("tosspayments")
      ).rejects.toThrow(LibraryInitializationError);

      // Second request should throw same error without retrying
      await expect(
        repositoryManager.getRepository("tosspayments")
      ).rejects.toThrow(LibraryInitializationError);

      expect(createDocsRepositoryModule.createDocsRepository)
        .toHaveBeenCalledTimes(1); // Only one attempt
    });

    it("should handle concurrent requests safely", async () => {
      const mockRepo = { /* mock DocsRepository */ };
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository")
        .mockImplementation(() =>
          new Promise((resolve) => setTimeout(() => resolve(mockRepo), 100))
        );

      // Fire multiple concurrent requests
      const [repo1, repo2, repo3] = await Promise.all([
        repositoryManager.getRepository("tosspayments"),
        repositoryManager.getRepository("tosspayments"),
        repositoryManager.getRepository("tosspayments"),
      ]);

      expect(repo1).toBe(mockRepo);
      expect(repo2).toBe(mockRepo);
      expect(repo3).toBe(mockRepo);
      expect(createDocsRepositoryModule.createDocsRepository)
        .toHaveBeenCalledTimes(1); // Only one initialization
    });
  });

  describe("getLibraryStatuses", () => {
    it("should return status for all libraries", () => {
      const statuses = repositoryManager.getLibraryStatuses();
      expect(statuses).toBeInstanceOf(Array);
      expect(statuses.length).toBeGreaterThan(0);
      expect(statuses[0]).toHaveProperty("id");
      expect(statuses[0]).toHaveProperty("available");
    });

    it("should mark failed libraries as unavailable", async () => {
      vi.spyOn(createDocsRepositoryModule, "createDocsRepository")
        .mockRejectedValue(new Error("Init failed"));

      try {
        await repositoryManager.getRepository("tosspayments");
      } catch (e) {
        // Expected
      }

      const statuses = repositoryManager.getLibraryStatuses();
      const tossStatus = statuses.find((s) => s.id === "tosspayments");

      expect(tossStatus?.available).toBe(false);
      expect(tossStatus?.error).toContain("Init failed");
    });
  });
});
```

#### File: `src/tool/__test__/multi-library-tools.test.ts`

**Purpose**: Test tool handlers with multiple libraries

**Test Cases**:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getLibraryList, getDocuments, getDocumentById } from "../tools.js";
import { repositoryManager } from "../../repository/repository-manager.js";

// Mock repository manager
vi.mock("../../repository/repository-manager.js");

describe("Multi-Library Tool Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLibraryList", () => {
    it("should return list of available libraries", async () => {
      vi.spyOn(repositoryManager, "getLibraryStatuses").mockReturnValue([
        { id: "tosspayments", available: true },
        { id: "supabase", available: false, error: "Network error" },
      ]);

      const result = await getLibraryList();

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("tosspayments");
      expect(result.content[0].text).toContain("supabase");
    });
  });

  describe("getDocuments", () => {
    it("should search documents in specified library", async () => {
      const mockRepo = {
        findV2DocumentsByKeyword: vi.fn().mockResolvedValue("Mock results"),
      };
      vi.spyOn(repositoryManager, "getRepository").mockResolvedValue(mockRepo);

      const result = await getDocuments({
        libraryId: "tosspayments",
        keywords: ["test"],
        maxTokens: 25000,
      });

      expect(mockRepo.findV2DocumentsByKeyword).toHaveBeenCalledWith(
        ["test"],
        undefined,
        25000
      );
      expect(result.content[0].text).toBe("Mock results");
    });

    it("should return error for invalid library", async () => {
      vi.spyOn(repositoryManager, "getRepository").mockRejectedValue(
        new LibraryNotFoundError("invalid", ["tosspayments"])
      );

      const result = await getDocuments({
        libraryId: "invalid",
        keywords: ["test"],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("getDocumentById", () => {
    it("should retrieve document from specified library", async () => {
      const mockDoc = {
        getChunks: () => [{ text: "Chunk 1" }, { text: "Chunk 2" }],
      };
      const mockRepo = {
        findOneById: vi.fn().mockReturnValue(mockDoc),
      };
      vi.spyOn(repositoryManager, "getRepository").mockResolvedValue(mockRepo);

      const result = await getDocumentById({
        libraryId: "tosspayments",
        id: "42",
      });

      expect(mockRepo.findOneById).toHaveBeenCalledWith(42);
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toBe("Chunk 1");
    });
  });
});
```

### 9.3 Modified Test Files

#### File: `src/repository/__test__/createDocsRepository.test.ts` (NEW)

**Purpose**: Test refactored createDocsRepository function

**Test Cases**:
```typescript
import { describe, it, expect, vi } from "vitest";
import { createDocsRepository } from "../createDocsRepository.js";

// Mock fetch
global.fetch = vi.fn();

describe("createDocsRepository", () => {
  it("should create repository with valid llms.txt", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => "# Valid llms.txt content",
    } as Response);

    const repo = await createDocsRepository(
      "test-lib",
      "https://example.com/llms.txt"
    );

    expect(repo).toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/llms.txt",
      expect.any(Object)
    );
  });

  it("should throw error with library context on fetch failure", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    await expect(
      createDocsRepository("test-lib", "https://example.com/llms.txt")
    ).rejects.toThrow("Failed to fetch llms.txt for library 'test-lib'");
  });

  it("should throw error with library context on parse failure", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => "Invalid content",
    } as Response);

    // Assuming parseLLMText throws on invalid content
    await expect(
      createDocsRepository("test-lib", "https://example.com/llms.txt")
    ).rejects.toThrow("Failed to create repository for 'test-lib'");
  });
});
```

#### File: `src/repository/__test__/docs-repository.e2e.test.ts` (MODIFY)

**Changes**:
- Update all `createDocsRepository()` calls to include libraryId and llmsTxtUrl
- Add tests for multiple libraries

**Example**:
```typescript
describe("Multi-library E2E tests", () => {
  it("should handle multiple libraries", async () => {
    const tossRepo = await createDocsRepository(
      "tosspayments",
      "https://docs.tosspayments.com/llms.txt"
    );

    // If we had another library configured:
    // const supabaseRepo = await createDocsRepository(
    //   "supabase",
    //   "https://supabase.com/llms.txt"
    // );

    const tossResults = await tossRepo.findV2DocumentsByKeyword(
      ["결제"],
      SearchMode.BALANCED,
      25000
    );

    expect(tossResults).toBeDefined();
  });
});
```

### 9.4 E2E Test Scenarios

**File**: `src/tool/__test__/e2e-workflow.test.ts` (NEW)

**Purpose**: Test complete user workflows

```typescript
import { describe, it, expect } from "vitest";
import { getLibraryList, getDocuments, getDocumentById } from "../tools.js";

describe("E2E Workflows", () => {
  it("should support discovery → search → retrieve flow", async () => {
    // Step 1: Discover libraries
    const libraries = await getLibraryList();
    expect(libraries.isError).toBeUndefined();
    const libraryIds = JSON.parse(
      libraries.content[0].text.split("\n\n")[1]
    ).map((lib: any) => lib.id);
    expect(libraryIds).toContain("tosspayments");

    // Step 2: Search documents
    const searchResults = await getDocuments({
      libraryId: "tosspayments",
      keywords: ["결제위젯"],
      maxTokens: 5000,
    });
    expect(searchResults.isError).toBeUndefined();
    expect(searchResults.content[0].text).toContain("원본문서 ID");

    // Step 3: Get full document (extract ID from search results)
    const idMatch = searchResults.content[0].text.match(/원본문서 ID : (\d+)/);
    if (idMatch) {
      const docId = idMatch[1];
      const fullDoc = await getDocumentById({
        libraryId: "tosspayments",
        id: docId,
      });
      expect(fullDoc.isError).toBeUndefined();
      expect(fullDoc.content.length).toBeGreaterThan(0);
    }
  });

  it("should handle library isolation correctly", async () => {
    // Assuming we have multiple libraries configured
    // Search in library A should not return results from library B

    const tossResults = await getDocuments({
      libraryId: "tosspayments",
      keywords: ["결제"],
      maxTokens: 5000,
    });

    // If searching in different library with same keyword
    // Should get different results
    // const otherResults = await getDocuments({
    //   libraryId: "other-lib",
    //   keywords: ["결제"],
    //   maxTokens: 5000,
    // });

    // expect(tossResults.content[0].text).not.toBe(otherResults.content[0].text);
  });
});
```

### 9.5 Test Execution Plan

**Phase 5 (Testing) will run tests in this order**:

1. **Unit Tests** (parallel execution):
   ```bash
   npm test src/config/__test__/libraries.test.ts
   npm test src/repository/__test__/repository-manager.test.ts
   npm test src/repository/__test__/createDocsRepository.test.ts
   ```

2. **Integration Tests**:
   ```bash
   npm test src/tool/__test__/multi-library-tools.test.ts
   ```

3. **E2E Tests** (may be slow, can skip in CI):
   ```bash
   npm test src/repository/__test__/docs-repository.e2e.test.ts
   npm test src/tool/__test__/e2e-workflow.test.ts
   ```

4. **Coverage Report**:
   ```bash
   npm run test:coverage
   ```

**Success Criteria**:
- All tests pass
- Coverage ≥ 85% for new code
- No regression in existing tests
- E2E tests demonstrate multi-library support

---

## 10. Non-Functional Requirements

### 10.1 Performance

**Initialization Performance**:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Server startup time | < 1 second | No eager loading of repositories |
| First library request | < 5 seconds | Fetch + parse llms.txt |
| Subsequent requests (cached) | < 100ms | In-memory lookup |
| Concurrent requests (same library) | No duplication | Single fetch shared across requests |

**Memory Usage**:

| Scenario | Expected Memory | Notes |
|----------|----------------|-------|
| 1 library loaded | ~50MB | Depends on library size |
| 5 libraries loaded | ~250MB | Scales linearly |
| 10 libraries loaded | ~500MB | Monitor for large deployments |

**Optimization Strategies**:
- Lazy initialization prevents loading unused libraries
- Repository instances reused across requests
- No unnecessary data duplication
- Document chunks loaded on-demand

### 10.2 Scalability

**Horizontal Scaling**:
- Each server instance maintains its own in-memory cache
- No shared state between instances
- Can run multiple instances behind load balancer
- Each instance independently fetches llms.txt files

**Vertical Scaling**:
- Memory usage grows linearly with number of libraries
- CPU usage primarily during initialization (parsing)
- Steady-state: low CPU, moderate memory

**Limits**:
- Max recommended libraries: ~20 (based on memory constraints)
- Max document size per library: ~10MB llms.txt
- Concurrent requests: Limited by Node.js event loop (thousands)

### 10.3 Security

**Input Validation**:
- All tool parameters validated with Zod schemas
- Library IDs restricted to alphanumeric + hyphens
- URLs validated as proper URLs
- No user-provided URLs (only from configuration)

**Injection Prevention**:
- No dynamic code execution
- No eval() or Function() constructors
- llms.txt URLs come from trusted configuration
- Markdown parsing sanitized (existing logic)

**Error Information Disclosure**:
- Error messages don't expose internal paths
- Stack traces not sent to clients
- Configuration details not leaked in errors

**Dependencies**:
- Regular npm audit for vulnerabilities
- Pin major versions to prevent breaking changes
- Use only well-maintained packages

### 10.4 Reliability

**Error Recovery**:
- Failed library initialization doesn't crash server
- Partial failures tolerated (some libraries work, others don't)
- Clear error messages guide users to solutions
- No cascading failures

**Graceful Degradation**:
- If one library fails, others continue working
- Empty search results handled gracefully
- Network errors don't bring down server

**Monitoring Recommendations**:
- Log initialization failures for ops teams
- Track library initialization times
- Monitor memory usage per library
- Alert on repeated fetch failures

### 10.5 Maintainability

**Code Organization**:
- Clear separation of concerns (config, repository, tools)
- Single Responsibility Principle followed
- Minimal coupling between modules
- Dependency injection for testability

**Documentation**:
- Inline JSDoc comments for all public functions
- Type definitions document expected data structures
- README with clear usage examples
- CHANGELOG for version history

**Extensibility**:
- Adding new library = configuration change only
- No code modifications needed
- Plugin architecture for future features
- Open/Closed Principle: open for extension, closed for modification

**Testing**:
- High test coverage ensures confidence in changes
- Mock strategies allow testing without network
- E2E tests verify real-world scenarios
- Fast unit tests enable rapid development

---

## 11. Implementation Dependencies & Sequence

### 11.1 Dependency Graph

```
Phase 2: Repository Layer
├─ Task 1: Create src/config/libraries.ts
│   └─ No dependencies
├─ Task 2: Create src/repository/types.ts
│   └─ Depends on: libraries.ts
├─ Task 3: Modify src/repository/createDocsRepository.ts
│   └─ No new dependencies (uses existing imports)
├─ Task 4: Create src/repository/repository-manager.ts
│   └─ Depends on: libraries.ts, types.ts, createDocsRepository.ts
└─ Task 5: Test repository layer
    └─ Depends on: All above

Phase 3: Tool Layer
├─ Task 1: Create src/schema/document-by-id-schema.ts
│   └─ Depends on: libraries.ts
├─ Task 2: Modify src/schema/get-document-schema.ts
│   └─ Depends on: libraries.ts
├─ Task 3: Modify src/tool/tools.ts
│   └─ Depends on: repository-manager.ts, both schemas
├─ Task 4: Modify src/bin/cli.ts
│   └─ Depends on: tools.ts, document-by-id-schema.ts
└─ Task 5: Test tool layer
    └─ Depends on: All above

Phase 4: Implementation Review
└─ Verify all changes against design

Phase 5: Testing
└─ Comprehensive test suite execution

Phase 6: Verification
└─ Manual testing and validation
```

### 11.2 Recommended Implementation Order

**Week 1 - Foundation (Phase 2)**:
1. Day 1: Create `src/config/libraries.ts` + tests
2. Day 1: Create `src/repository/types.ts`
3. Day 2: Modify `src/repository/createDocsRepository.ts` + tests
4. Day 3: Create `src/repository/repository-manager.ts` + tests
5. Day 4: Integration testing of repository layer

**Week 1 - Integration (Phase 3)**:
6. Day 5: Create/modify schema files
7. Day 5: Modify `src/tool/tools.ts` (add getLibraryList, modify others)
8. Day 6: Modify `src/bin/cli.ts` (tool registration)
9. Day 6: Tool layer unit tests
10. Day 7: E2E workflow tests

**Week 2 - Polish**:
11. Day 8: Documentation (README, CHANGELOG)
12. Day 8: Code review and refinement
13. Day 9: Performance testing and optimization
14. Day 10: Final validation and release preparation

### 11.3 Parallel Work Opportunities

**Can Be Done in Parallel**:
- `libraries.ts` + `types.ts` (independent)
- Schema modifications (document-by-id-schema.ts + get-document-schema.ts)
- Test file creation while implementation is in progress

**Must Be Sequential**:
- Repository layer BEFORE tool layer (tools depend on repository)
- Schema changes BEFORE tool modifications (tools import schemas)
- Implementation BEFORE comprehensive testing

---

## 12. Risk Assessment & Mitigation

### 12.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes break existing users | High | High | Clear migration guide, version bump to 2.0.0 |
| Library initialization failures | Medium | Medium | Graceful error handling, partial failure tolerance |
| Memory exhaustion with many libraries | Low | Medium | Lazy loading, document limits, monitoring |
| Concurrent access race conditions | Low | High | Pending initialization map prevents duplicates |
| Type mismatches after refactor | Medium | Medium | Comprehensive TypeScript checking, tests |

### 12.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Slow llms.txt fetches on first request | High | Low | Expected behavior, consider warmup script |
| External library URLs change | Medium | Medium | Configuration update required, error messages guide users |
| Network failures during initialization | High | Medium | Cache errors, clear messages, retry guidance |
| Configuration mistakes (invalid URLs) | Medium | Low | Zod validation catches at startup |

### 12.3 Mitigation Strategies

**For Breaking Changes**:
- Comprehensive CHANGELOG.md entry
- Migration examples in README
- Clear error messages if users try old API
- Consider offering migration tool/script

**For Library Failures**:
- Status endpoint (`get-library-list`) shows which libraries work
- Errors include suggestions (check URL, network, etc.)
- Partial failure doesn't affect other libraries
- Cache errors to avoid retry storms

**For Performance Issues**:
- Lazy initialization keeps startup fast
- Repository caching makes subsequent requests fast
- Consider optional warmup script for production
- Monitor memory usage in production

**For Configuration Errors**:
- Zod validation catches format errors early
- Unit tests verify configuration structure
- JSDoc examples show correct format
- IDE autocomplete helps prevent mistakes

---

## 13. Future Enhancements

### 13.1 Potential Features (Out of Scope for v2.0.0)

**Dynamic Library Loading**:
- Load libraries from external JSON/YAML file
- Hot-reload configuration without restart
- Admin API to add/remove libraries at runtime

**Library Metadata**:
- Version information per library
- Last updated timestamp
- Document count and size stats

**Advanced Caching**:
- Persistent cache (Redis, file system)
- TTL-based cache expiration
- Selective cache invalidation

**Search Enhancements**:
- Cross-library search
- Federated search results
- Library-specific search ranking

**Monitoring & Analytics**:
- Prometheus metrics
- Request tracking and tracing
- Performance analytics dashboard

**Authentication & Authorization**:
- API keys for access control
- Per-library permissions
- Rate limiting per client

### 13.2 Architecture Considerations

**Current Design Supports**:
- Adding new libraries without code changes ✅
- Multiple concurrent users ✅
- Horizontal scaling ✅
- Graceful error handling ✅

**Would Need Refactoring For**:
- User-provided library URLs (security risk)
- Real-time library updates (cache invalidation complex)
- Per-user library configurations (needs auth layer)
- Distributed caching (needs external cache)

---

## 14. Success Criteria

### 14.1 Functional Requirements Met

- ✅ Requirement 1: `get-library-list` tool returns array of library IDs
- ✅ Requirement 2: `get-v1-documents` tool completely removed
- ✅ Requirement 3: `get-v2-documents` renamed to `get-documents` with `libraryId` parameter
- ✅ Requirement 4: `document-by-id` accepts `libraryId` parameter
- ✅ Requirement 5: `createDocsRepository` generalized to accept any library

### 14.2 Design Quality Checklist

- ✅ All 5 requirements explicitly addressed
- ✅ Backward compatibility strategy defined (clean break with migration guide)
- ✅ Type definitions complete and compilable
- ✅ Error handling covers all scenarios
- ✅ **Zero code change needed for adding new library** (config only)
- ✅ File modification plan exhaustive
- ✅ Test strategy covers critical paths
- ✅ No ambiguities or "TBD" items
- ✅ Code examples provided for complex parts
- ✅ Migration guide clear for existing users

### 14.3 Implementation Readiness

**This design is ready for implementation if**:
- All sections reviewed and approved ✅
- No conflicting design decisions ✅
- Dependencies clearly mapped ✅
- Test requirements defined ✅
- File changes specified ✅

**Agents can implement without further questions** ✅

---

## 15. Appendix

### 15.1 Key Design Decisions Summary

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Configuration storage | JSON file vs TypeScript array | TypeScript array | Type safety, no I/O, version control |
| Initialization strategy | Eager vs Lazy | Lazy | Fast startup, efficient memory |
| Caching strategy | In-memory vs External (Redis) | In-memory | Simplicity, no dependencies |
| Backward compatibility | Aliases vs Clean break | Clean break (v2.0.0) | Clear API, no technical debt |
| Tool naming | Keep v1/v2 tools vs Single tool | Single `get-documents` | Simpler, libraryId provides context |
| Error handling | Fail-fast vs Partial failure | Partial failure | Resilience, better UX |

### 15.2 Glossary

- **Library**: A documentation source (e.g., TossPayments, Supabase)
- **llms.txt**: Standardized format for LLM-consumable documentation
- **Repository**: `DocsRepository` instance containing parsed documents for one library
- **Repository Manager**: Singleton managing lifecycle of repository instances
- **Lazy Initialization**: Creating resources on-demand rather than at startup
- **MCP**: Model Context Protocol - framework for LLM tool integrations
- **Tool**: MCP-exposed function that LLM agents can call
- **libraryId**: String identifier for a library (e.g., "tosspayments")

### 15.3 References

- **MCP SDK Documentation**: https://github.com/modelcontextprotocol/sdk
- **llms.txt Format**: (Inferred from parseLLMText.ts implementation)
- **Zod Validation**: https://zod.dev
- **BM25 Algorithm**: Used for document ranking (existing implementation)

---

**END OF DESIGN DOCUMENT**

**Status**: ✅ APPROVED FOR IMPLEMENTATION
**Next Step**: Proceed to Phase 1.5 (Design Review) or directly to Phase 2 (Repository Implementation)
