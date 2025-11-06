import { Category } from "../constants/category.js";
import { EnhancedChunk } from "./splitter/types.js";

export interface DocumentMetadata {
  title: string;
  description: string;
  keyword: string[];
}

export interface MarkdownDocument {
  markdown: string;
  metadata: DocumentMetadata;
  enhancedChunks: EnhancedChunk[]; // New field added
}

export interface DocumentChunk {
  id: number;
  chunkId: number;
  originTitle: string;
  text: string; // Full text including context
  rawText: string; // Original text only
  wordCount: number;
  estimatedTokens: number; // Token count including context
  headerStack: string[]; // Header path
}

export interface RemoteMarkdownDocument extends MarkdownDocument {
  link: string;
}

export interface RawDocs {
  text: string;
  title: string;
  link: string;
  version?: "v1" | "v2";
  description: string;
  category: Category;
}
