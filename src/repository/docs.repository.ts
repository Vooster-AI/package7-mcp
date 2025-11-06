import { SearchMode } from "../constants/search-mode.js";
import { CategoryWeightCalculator } from "../document/category-weight-calculator.js";
import {
  Result,
  BM25Calculator,
} from "../document/bm25-calculator.js";
import { Document } from "../document/document.js";

import { SynonymDictionary } from "../document/synonym-dictionary.js";
import { TokenEstimator } from "../document/token-estimator.js";
import { DocumentChunk } from "../document/types.js";

export class DocsRepository {
  private readonly documentV1BM25Calculator: BM25Calculator;
  private readonly documentV2BM25Calculator: BM25Calculator;

  private readonly allV1Keywords: Set<string>;
  private readonly allV2Keywords: Set<string>;

  private static readonly TRUNCATION_WARNING =
    "\n\n... (there is more content...)";

  constructor(
    private readonly documents: Document[],
    private readonly categoryWeightCalculator: CategoryWeightCalculator,
    private readonly synonymDictionary: SynonymDictionary
  ) {
    const v1Documents = documents.filter(
      (document) => document.version === "v1"
    );

    const v2Documents = documents.filter(
      (document) => document.version === "v2"
    );

    this.documentV1BM25Calculator = new BM25Calculator(v1Documents);
    this.documentV2BM25Calculator = new BM25Calculator(v2Documents);

    this.allV2Keywords = new Set(v1Documents.map((doc) => doc.keywords).flat());
    this.allV1Keywords = new Set(v2Documents.map((doc) => doc.keywords).flat());
  }

  getAllV1Keywords(): string[] {
    return Array.from(this.allV1Keywords);
  }

  getAllV2Keywords(): string[] {
    return Array.from(this.allV2Keywords);
  }

  async findV1DocumentsByKeyword(
    keywords: string[],
    searchMode: SearchMode = SearchMode.BALANCED,
    maxTokens: number
  ): Promise<string> {
    const converted = this.synonymDictionary.convertToSynonyms(keywords);

    const results = this.documentV1BM25Calculator.calculate(
      converted,
      searchMode
    );

    // Apply weights by category
    const weightedResults = this.categoryWeightCalculator.apply(
      results,
      this.documents
    );

    return this.normalize(weightedResults, maxTokens);
  }

  async findV2DocumentsByKeyword(
    keywords: string[],
    searchMode: SearchMode = SearchMode.BALANCED,
    maxTokens: number
  ): Promise<string> {
    const converted = this.synonymDictionary.convertToSynonyms(keywords);

    const results = this.documentV2BM25Calculator.calculate(
      converted,
      searchMode
    );

    // Apply weights by category
    const weightedResults = this.categoryWeightCalculator.apply(
      results,
      this.documents
    );

    return this.normalize(weightedResults, maxTokens);
  }

  findOneById(id: number) {
    return this.documents[id];
  }

  private normalize(results: Result[], maxTokens: number): string {
    const groupedByDocId = this.groupResultsByDocId(results);
    const docs: string[] = [];
    let currentTokens = 0;

    // Look up chunks for each document
    for (const [docId, chunkIds] of groupedByDocId.entries()) {
      const document = this.findOneById(docId);

      const documentChunks = document.findByChunkIds(chunkIds, {
        windowSize: 1,
      });

      if (documentChunks.length > 0) {
        const processedChunk = this.smartTruncateChunks(
          documentChunks,
          maxTokens - currentTokens
        );

        if (processedChunk) {
          const header = `# Original Document Title: ${document.title}\n* Original Document ID: ${document.id}`;

          const headerTokens = TokenEstimator.estimate(header);

          maxTokens -= headerTokens;

          docs.push(header);
          docs.push(processedChunk.text);
          currentTokens += processedChunk.tokens;

          if (currentTokens >= maxTokens) {
            break;
          }
        }
      }
    }

    return docs.join("\n\n");
  }

  /**
   * Group Result array by document ID
   */
  private groupResultsByDocId(results: Result[]): Map<number, number[]> {
    const grouped = new Map<number, number[]>();

    for (const result of results) {
      if (!grouped.has(result.id)) {
        grouped.set(result.id, []);
      }
      grouped.get(result.id)!.push(result.chunkId);
    }

    // Remove duplicates and sort chunkIds for each group
    for (const [docId, chunkIds] of grouped.entries()) {
      grouped.set(
        docId,
        [...new Set(chunkIds)].sort((a, b) => a - b)
      );
    }

    return grouped;
  }

  /**
   * Smartly truncate chunks within token limit.
   * @param chunks Array of DocumentChunks to process
   * @param remainingTokens Number of remaining tokens
   * @returns Processed text and number of tokens used
   */
  private smartTruncateChunks(
    chunks: DocumentChunk[],
    remainingTokens: number
  ): { text: string; tokens: number } | null {
    if (chunks.length === 0) return null;

    let availableTokens = remainingTokens;
    if (availableTokens <= 0) return null;

    let selectedChunks: DocumentChunk[] = [];
    let usedTokens = 0;

    // Select chunks while checking token count for each
    for (const chunk of chunks) {
      const chunkTokens = chunk.estimatedTokens;

      if (availableTokens >= chunkTokens) {
        selectedChunks.push(chunk);
        availableTokens -= chunkTokens;
        usedTokens += chunkTokens;
      } else {
        // Check if partial selection is possible
        const partialChunk = this.tryPartialChunk(chunk, availableTokens);
        if (partialChunk) {
          selectedChunks.push(partialChunk.chunk);
          usedTokens += partialChunk.tokens;
        }
        break;
      }
    }

    if (selectedChunks.length === 0) {
      return null;
    }

    const needsTruncation = selectedChunks.length < chunks.length;
    const content = selectedChunks.map((chunk) => chunk.rawText).join("\n\n");
    const fullText =
      content +
      (needsTruncation ? DocsRepository.TRUNCATION_WARNING : "");

    const finalTokens =
      usedTokens +
      (needsTruncation
        ? TokenEstimator.estimate(DocsRepository.TRUNCATION_WARNING)
        : 0);

    return {
      text: fullText,
      tokens: finalTokens,
    };
  }

  /**
   * Attempt to partially truncate a chunk within token limit.
   * @param chunk The DocumentChunk to truncate
   * @param availableTokens Number of available tokens
   * @returns Partially truncated chunk and token count
   */
  private tryPartialChunk(
    chunk: DocumentChunk,
    availableTokens: number
  ): { chunk: DocumentChunk; tokens: number } | null {
    if (availableTokens < 100) return null; // Minimum tokens required

    // Attempt to cut at semantic boundaries (sentences, paragraphs, list items, etc.)
    const semanticBoundaries = this.findSemanticBoundaries(chunk.text);

    for (let i = semanticBoundaries.length - 1; i >= 0; i--) {
      const truncatedText = chunk.text.substring(0, semanticBoundaries[i]);
      const estimatedTokens = TokenEstimator.estimate(truncatedText);

      if (estimatedTokens <= availableTokens) {
        return {
          chunk: { ...chunk, text: truncatedText },
          tokens: estimatedTokens,
        };
      }
    }

    return null;
  }

  /**
   * Find semantic boundary points in text.
   * @param text The text to analyze
   * @returns Array of boundary positions (character indices)
   */
  private findSemanticBoundaries(text: string): number[] {
    const boundaries: number[] = [];

    // 1. Paragraph boundaries (double newline)
    let match;
    const paragraphRegex = /\n\n/g;
    while ((match = paragraphRegex.exec(text)) !== null) {
      boundaries.push(match.index);
    }

    // 2. Sentence boundaries (period, exclamation mark, question mark + space)
    const sentenceRegex = /[.!?]\s+/g;
    while ((match = sentenceRegex.exec(text)) !== null) {
      boundaries.push(match.index + match[0].length);
    }

    // 3. List item boundaries
    const listRegex = /\n-\s+/g;
    while ((match = listRegex.exec(text)) !== null) {
      boundaries.push(match.index);
    }

    // 4. Code block boundaries
    const codeBlockRegex = /```[\s\S]*?```/g;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      boundaries.push(match.index + match[0].length);
    }

    // Sort and remove duplicates
    return [...new Set(boundaries)].sort((a, b) => a - b);
  }
}
