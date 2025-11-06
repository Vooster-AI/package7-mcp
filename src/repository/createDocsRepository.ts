import { CategoryWeightCalculator } from "../document/category-weight-calculator.js";
import { MarkdownDocumentFetcher } from "../document/markdown-document.fetcher.js";
import { parseLLMText } from "../document/parseLLMText.js";
import { DocumentLoader } from "../document/document.loader.js";
import { DocsRepository } from "./docs.repository.js";
import { SynonymDictionary } from "../document/synonym-dictionary.js";
import { fetchWithHeaders } from "../utils/fetch.js";

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
): Promise<DocsRepository> {
  try {
    const response = await fetchWithHeaders(llmsTxtUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch llms.txt for library '${libraryId}': ${response.status} ${response.statusText}`
      );
    }

    const llmText = await response.text();

    const rawDocs = parseLLMText(llmText, libraryId, llmsTxtUrl);

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
