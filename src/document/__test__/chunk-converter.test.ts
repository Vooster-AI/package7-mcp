import { describe, expect, it } from "vitest";
import { ChunkConverter } from "../chunk-converter.js";
import { EnhancedChunk } from "../splitter/types.js";
import { DocumentMetadata } from "../types.js";

describe("ChunkConverter", () => {
  const mockMetadata: DocumentMetadata = {
    title: "결제 연동 가이드",
    description: "토스페이먼츠 결제 연동 방법",
    keyword: ["결제", "카드", "API"],
  };

  const mockEnhancedChunk: EnhancedChunk = {
    content: "# 카드 결제\n\n카드 정보를 입력받아 결제를 진행합니다.",
    headerStack: ["결제 연동", "카드 결제"],
    estimatedTokens: 25,
  };

  describe("convert", () => {
    it("converts EnhancedChunk to DocumentChunk", () => {
      const result = ChunkConverter.convert(
        mockEnhancedChunk,
        mockMetadata,
        1,
        0
      );

      expect(result.id).toBe(1);
      expect(result.chunkId).toBe(0);
      expect(result.originTitle).toBe("결제 연동 가이드");
      expect(result.rawText).toBe(
        "# 카드 결제\n\n카드 정보를 입력받아 결제를 진행합니다."
      );
      expect(result.headerStack).toEqual(["결제 연동", "카드 결제"]);
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.estimatedTokens).toBeGreaterThan(0);
    });

    it("generates text with context prefix", () => {
      const result = ChunkConverter.convert(
        mockEnhancedChunk,
        mockMetadata,
        1,
        0
      );

      expect(result.text).toMatchInlineSnapshot(`
        "## Metadata 
        Keywords: 결제, 카드, API
        Header Path: 결제 연동 > 카드 결제

        # 카드 결제

        카드 정보를 입력받아 결제를 진행합니다."
      `);
    });

    it("creates copies of headerStack and keywords", () => {
      const result = ChunkConverter.convert(
        mockEnhancedChunk,
        mockMetadata,
        1,
        0
      );

      // Should be different objects from original
      expect(result.headerStack).not.toBe(mockEnhancedChunk.headerStack);

      // But contents should be the same
      expect(result.headerStack).toEqual(mockEnhancedChunk.headerStack);
    });
  });

  describe("convertAll", () => {
    it("converts multiple EnhancedChunks to DocumentChunk array", () => {
      const chunks: EnhancedChunk[] = [
        mockEnhancedChunk,
        {
          ...mockEnhancedChunk,
          content: "## 인증 결제\n\n3D Secure를 통한 인증 결제입니다.",
          headerStack: ["결제 연동", "카드 결제", "인증 결제"],
        },
      ];

      const results = ChunkConverter.convertAll(chunks, mockMetadata, 1);

      expect(results).toHaveLength(2);
      expect(results[0].chunkId).toBe(0);
      expect(results[1].chunkId).toBe(1);
      expect(results[1].headerStack).toEqual([
        "결제 연동",
        "카드 결제",
        "인증 결제",
      ]);
    });
  });

  describe("convertRaw", () => {
    it("creates DocumentChunk with pure content without context", () => {
      const result = ChunkConverter.convertRaw(
        mockEnhancedChunk,
        mockMetadata,
        1,
        0
      );

      expect(result.text).toBe(mockEnhancedChunk.content);
      expect(result.rawText).toBe(mockEnhancedChunk.content);
      expect(result.estimatedTokens).toBe(mockEnhancedChunk.estimatedTokens);

      // Should not include context prefix
      expect(result.text).not.toContain("Document:");
      expect(result.text).not.toContain("Keywords:");
      expect(result.text).not.toContain("Header Path:");
    });
  });

  describe("Context prefix generation", () => {
    it("handles empty headerStack", () => {
      const chunkWithoutHeaders: EnhancedChunk = {
        ...mockEnhancedChunk,
        headerStack: [],
      };

      const result = ChunkConverter.convert(
        chunkWithoutHeaders,
        mockMetadata,
        1,
        0
      );

      expect(result.text).toMatchInlineSnapshot(`
        "## Metadata 
        Keywords: 결제, 카드, API

        # 카드 결제

        카드 정보를 입력받아 결제를 진행합니다."
      `);
    });

    it("handles empty keywords", () => {
      const metadataWithoutKeywords: DocumentMetadata = {
        ...mockMetadata,
        keyword: [],
      };

      const result = ChunkConverter.convert(
        mockEnhancedChunk,
        metadataWithoutKeywords,
        1,
        0
      );

      expect(result.text).toMatchInlineSnapshot(`
        "## Metadata 
        Header Path: 결제 연동 > 카드 결제

        # 카드 결제

        카드 정보를 입력받아 결제를 진행합니다."
      `);
    });

    it("limits many keywords to 8", () => {
      const metadataWithManyKeywords: DocumentMetadata = {
        ...mockMetadata,
        keyword: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      };

      const result = ChunkConverter.convert(
        mockEnhancedChunk,
        metadataWithManyKeywords,
        1,
        0
      );

      expect(result.text).toMatchInlineSnapshot(`
        "## Metadata 
        Keywords: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
        Header Path: 결제 연동 > 카드 결제

        # 카드 결제

        카드 정보를 입력받아 결제를 진행합니다."
      `);
    });

    it("filters undefined and empty string headers", () => {
      const chunkWithBadHeaders: EnhancedChunk = {
        ...mockEnhancedChunk,
        headerStack: ["결제 연동", "", "카드 결제", "   ", "인증 결제"],
      };

      const result = ChunkConverter.convert(
        chunkWithBadHeaders,
        mockMetadata,
        1,
        0
      );

      expect(result.text).toContain(
        "Header Path: 결제 연동 > 카드 결제 > 인증 결제"
      );
      expect(result.text).not.toContain("  >  ");
    });
  });
});
