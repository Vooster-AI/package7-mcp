/**
 * Heuristic-based token estimator
 * Estimates the number of tokens in text with zero dependencies.
 * Optimized for documents with mixed Korean, English, and code.
 */
export class TokenEstimator {
  // Base character to token ratio (on average 0.75 tokens per character)
  private static readonly CHAR_TO_TOKEN_RATIO = 0.75;

  // Korean weight (Korean has high token ratio)
  private static readonly KOREAN_WEIGHT = 0.8;

  // Code block ratio (code is token efficient)
  private static readonly CODE_BLOCK_RATIO = 0.3;

  // Average tokens per URL
  private static readonly URL_TOKENS = 8;

  // Inline code weight
  private static readonly INLINE_CODE_RATIO = 0.4;

  /**
   * Estimates the number of tokens in text.
   * @param text The text to estimate tokens for
   * @returns The estimated number of tokens
   */
  static estimate(text: string): number {
    if (!text || text.length === 0) return 0;

    // Base estimate based on character count
    let estimate = text.length * this.CHAR_TO_TOKEN_RATIO;

    // Apply Korean character weight
    estimate += this.calculateKoreanWeight(text);

    // Optimize code block weight
    estimate += this.calculateCodeBlockWeight(text);

    // Optimize inline code weight
    estimate += this.calculateInlineCodeWeight(text);

    // Apply URL weight
    estimate += this.calculateUrlWeight(text);

    // Markdown header weight (headers are usually short but important)
    estimate += this.calculateHeaderWeight(text);

    return Math.ceil(Math.max(estimate, 1)); // Minimum 1 token
  }

  /**
   * Calculate weight for Korean characters
   */
  private static calculateKoreanWeight(text: string): number {
    const koreanChars = (text.match(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g) || []).length;
    return koreanChars * this.KOREAN_WEIGHT;
  }

  /**
   * Calculate weight for code blocks (token efficient)
   */
  private static calculateCodeBlockWeight(text: string): number {
    const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
    let adjustment = 0;

    for (const block of codeBlocks) {
      // Code blocks are more token efficient than regular text
      const normalEstimate = block.length * this.CHAR_TO_TOKEN_RATIO;
      const codeEstimate = block.length * this.CODE_BLOCK_RATIO;
      adjustment += codeEstimate - normalEstimate;
    }

    return adjustment;
  }

  /**
   * Calculate weight for inline code
   */
  private static calculateInlineCodeWeight(text: string): number {
    // Find inline code after removing code blocks
    const withoutCodeBlocks = text.replace(/```[\s\S]*?```/g, "");
    const inlineCodes = withoutCodeBlocks.match(/`[^`]+`/g) || [];

    let adjustment = 0;
    for (const code of inlineCodes) {
      const normalEstimate = code.length * this.CHAR_TO_TOKEN_RATIO;
      const codeEstimate = code.length * this.INLINE_CODE_RATIO;
      adjustment += codeEstimate - normalEstimate;
    }

    return adjustment;
  }

  /**
   * Calculate weight for URLs
   */
  private static calculateUrlWeight(text: string): number {
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    let adjustment = 0;

    for (const url of urls) {
      // URLs typically consume many tokens, so apply additional weight
      const normalEstimate = url.length * this.CHAR_TO_TOKEN_RATIO;
      const urlEstimate = Math.max(this.URL_TOKENS, normalEstimate);
      adjustment += urlEstimate - normalEstimate;
    }

    return adjustment;
  }

  /**
   * Calculate weight for markdown headers
   */
  private static calculateHeaderWeight(text: string): number {
    const headers = text.match(/^#{1,6}\s+.+$/gm) || [];
    // Headers usually contain important keywords, so add some weight
    return headers.length * 2;
  }

  /**
   * Calculate total token count for multiple texts.
   * @param texts Array of texts to calculate tokens for
   * @returns Total number of tokens
   */
  static estimateTotal(texts: string[]): number {
    return texts.reduce((total, text) => total + this.estimate(text), 0);
  }

  /**
   * Check if text exceeds the given token limit.
   * @param text The text to check
   * @param maxTokens The maximum number of tokens
   * @returns Whether it exceeds the limit
   */
  static exceedsLimit(text: string, maxTokens: number): boolean {
    return this.estimate(text) > maxTokens;
  }
}
