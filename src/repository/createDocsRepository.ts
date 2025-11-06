import { CategoryWeightCalculator } from "../document/category-weight-calculator.js";
import { MarkdownDocumentFetcher } from "../document/markdown-document.fetcher.js";
import { parseLLMText } from "../document/parseLLMText.js";
import { DocumentLoader } from "../document/document.loader.js";
import { DocsRepository } from "./docs.repository.js";
import { SynonymDictionary } from "../document/synonym-dictionary.js";

export async function createDocsRepository(
  link = "https://docs.tosspayments.com/llms.txt"
): Promise<DocsRepository> {
  const response = await fetch(link, {
    headers: {
      "user-agent": "Package7MCP",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch LLM text: ${response.statusText}`);
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
}
