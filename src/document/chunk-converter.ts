import { EnhancedChunk } from "./splitter/types.js";
import { TokenEstimator } from "./token-estimator.js";
import { DocumentChunk, DocumentMetadata } from "./types.js";

/**
 * Utility to convert EnhancedChunk to DocumentChunk
 * Creates final chunks with context information.
 */
export class ChunkConverter {
  /**
   * Converts EnhancedChunk to DocumentChunk.
   * @param enhancedChunk The EnhancedChunk to convert
   * @param metadata Document metadata
   * @param documentId Document ID
   * @param chunkIndex Chunk index
   * @returns DocumentChunk with context
   */
  static convert(
    enhancedChunk: EnhancedChunk,
    metadata: DocumentMetadata,
    documentId: number,
    chunkIndex: number
  ): DocumentChunk {
    // Build context prefix
    const contextPrefix = this.buildContextPrefix(
      metadata,
      enhancedChunk.headerStack
    );

    // Full text including context
    const fullText = contextPrefix + enhancedChunk.content;

    // Calculate token count including context
    const fullTokens = TokenEstimator.estimate(fullText);

    return {
      id: documentId,
      chunkId: chunkIndex,
      originTitle: metadata.title,
      text: fullText,
      rawText: enhancedChunk.content,
      wordCount: fullText.split(/\s+/).length,
      estimatedTokens: fullTokens,
      headerStack: [...enhancedChunk.headerStack], // Create a copy
    };
  }

  /**
   * Converts multiple EnhancedChunks to DocumentChunk array.
   * @param enhancedChunks Array of EnhancedChunks to convert
   * @param metadata Document metadata
   * @param documentId Document ID
   * @returns Array of DocumentChunks
   */
  static convertAll(
    enhancedChunks: EnhancedChunk[],
    metadata: DocumentMetadata,
    documentId: number
  ): DocumentChunk[] {
    return enhancedChunks.map((chunk, index) =>
      this.convert(chunk, metadata, documentId, index)
    );
  }

  /**
   * Builds context prefix.
   * @param metadata Document metadata
   * @param headerStack Header path
   * @returns Context prefix string
   */
  private static buildContextPrefix(
    metadata: DocumentMetadata,
    headerStack: string[]
  ): string {
    const headerPath = headerStack.filter((h) => h && h.trim()).join(" > ");
    const keywordList = metadata.keyword.join(", "); // Use keywords from document metadata

    let contextPrefix = `## Metadata \n`;

    if (keywordList) {
      contextPrefix += `Keywords: ${keywordList}\n`;
    }

    if (headerPath) {
      contextPrefix += `Header Path: ${headerPath}\n`;
    }

    contextPrefix += "\n";

    return contextPrefix;
  }

  /**
   * Creates DocumentChunk with pure content without context.
   * (Used in smart truncation during response generation)
   * @param enhancedChunk The EnhancedChunk to convert
   * @param metadata Document metadata
   * @param documentId Document ID
   * @param chunkIndex Chunk index
   * @returns DocumentChunk with pure content only
   */
  static convertRaw(
    enhancedChunk: EnhancedChunk,
    metadata: DocumentMetadata,
    documentId: number,
    chunkIndex: number
  ): DocumentChunk {
    return {
      id: documentId,
      chunkId: chunkIndex,
      originTitle: metadata.title,
      text: enhancedChunk.content,
      rawText: enhancedChunk.content,
      wordCount: enhancedChunk.content.split(/\s+/).length,
      estimatedTokens: enhancedChunk.estimatedTokens,
      headerStack: [...enhancedChunk.headerStack],
    };
  }
}
