import { Category } from "../constants/category.js";
import { ChunkConverter } from "./chunk-converter.js";
import { DocumentChunk, RemoteMarkdownDocument } from "./types.js";

export class Document {
  private readonly chunks: DocumentChunk[] = [];

  constructor(
    private readonly keywordSet: Set<string>,
    private readonly remoteMarkdownDocument: RemoteMarkdownDocument,
    private readonly _version: string | undefined,
    public readonly id: number,
    private readonly _category: Category
  ) {
    const convertedChunks = ChunkConverter.convertAll(
      remoteMarkdownDocument.enhancedChunks,
      remoteMarkdownDocument.metadata,
      this.id
    );
    // Reset chunkId to be unique
    convertedChunks.forEach((chunk, index) => {
      chunk.chunkId = this.id * 1000 + index;
      this.chunks.push(chunk);
    });
  }

  /**
   * Returns an optimized chunk array based on multiple chunkIds
   * Consecutive chunks are merged, and window is applied to remove duplicates
   */
  findByChunkIds(
    chunkIds: number[],
    options: { windowSize: number } = { windowSize: 1 }
  ): DocumentChunk[] {
    if (chunkIds.length === 0) return [];

    const { windowSize } = options;

    // Convert chunkId to index and validate
    const validIndices = chunkIds
      .map((chunkId) => chunkId - this.id * 1000)
      .filter((index) => index >= 0 && index < this.chunks.length)
      .sort((a, b) => a - b);

    if (validIndices.length === 0) return [];

    // Remove duplicates
    const uniqueIndices = [...new Set(validIndices)];

    if (uniqueIndices.length === 1) {
      // Apply window for single chunk
      const chunkIndex = uniqueIndices[0];
      const start = Math.max(0, chunkIndex - windowSize);
      const end = Math.min(this.chunks.length - 1, chunkIndex + windowSize);
      return this.chunks.slice(start, end + 1);
    }

    // Create groups for analyzing consecutiveness
    const groups = this.groupConsecutiveIndices(uniqueIndices, windowSize);

    const result: DocumentChunk[] = [];
    for (const group of groups) {
      const start = Math.max(0, Math.min(...group) - windowSize);
      const end = Math.min(
        this.chunks.length - 1,
        Math.max(...group) + windowSize
      );
      result.push(...this.chunks.slice(start, end + 1));
    }

    // Remove duplicates (based on chunkId)
    const uniqueChunks = new Map<number, DocumentChunk>();
    for (const chunk of result) {
      uniqueChunks.set(chunk.chunkId, chunk);
    }

    return Array.from(uniqueChunks.values()).sort(
      (a, b) => a.chunkId - b.chunkId
    );
  }

  /**
   * Group chunk indices considering consecutiveness and window size
   */
  private groupConsecutiveIndices(
    indices: number[],
    windowSize: number
  ): number[][] {
    if (indices.length === 0) return [];

    const groups: number[][] = [];
    let currentGroup = [indices[0]];

    for (let i = 1; i < indices.length; i++) {
      const prev = indices[i - 1];
      const current = indices[i];

      // Check if current index can be connected with previous index
      // Considering window size, connect if gap is (windowSize * 2 + 1) or less
      const maxGap = windowSize * 2 + 1;
      if (current - prev <= maxGap) {
        currentGroup.push(current);
      } else {
        // Start a new group
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }

    groups.push(currentGroup);
    return groups;
  }

  getChunks(): DocumentChunk[] {
    return this.chunks;
  }

  get keywords(): string[] {
    return Array.from(this.keywordSet);
  }

  get content(): string {
    return this.remoteMarkdownDocument.markdown;
  }

  get title() {
    return this.remoteMarkdownDocument.metadata.title;
  }

  get version(): string | undefined {
    return this._version;
  }

  get category(): Category {
    return this._category;
  }

  get description() {
    return this.remoteMarkdownDocument.metadata.description;
  }

  toString() {
    return this.remoteMarkdownDocument.markdown;
  }

  toJSON() {
    return {
      version: this.version,
      id: this.id,
      title: this.title,
      link: this.remoteMarkdownDocument.link,
      description: this.description,
      keywords: Array.from(this.keywordSet),
    };
  }
}
