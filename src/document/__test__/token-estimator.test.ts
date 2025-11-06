import { describe, expect, it } from "vitest";
import { TokenEstimator } from "../token-estimator.js";

describe("TokenEstimator", () => {
  describe("Basic token estimation", () => {
    it("empty text returns 0 tokens", () => {
      expect(TokenEstimator.estimate("")).toBe(0);
      expect(TokenEstimator.estimate(null as any)).toBe(0);
      expect(TokenEstimator.estimate(undefined as any)).toBe(0);
    });

    it("estimates token count for English text", () => {
      const text = "Hello world";
      const estimated = TokenEstimator.estimate(text);

      // Approximately character count * 0.75
      expect(estimated).toBeGreaterThan(5);
      expect(estimated).toBeLessThan(15);
    });

    it("Korean text has weight applied", () => {
      const englishText = "Payment integration guide";
      const koreanText = "결제 연동 가이드";

      const englishTokens = TokenEstimator.estimate(englishText);
      const koreanTokens = TokenEstimator.estimate(koreanText);

      // Korean text is estimated with more tokens due to weight
      expect(koreanTokens).toBeGreaterThan(englishTokens * 0.6);
    });
  });

  describe("Code block handling", () => {
    it("code blocks are calculated efficiently", () => {
      const normalText = "This is a normal text with same length as code below";
      const codeText = "```javascript\nconst payment = new Payment();\n```";

      const normalTokens = TokenEstimator.estimate(normalText);
      const codeTokens = TokenEstimator.estimate(codeText);

      // Code blocks should have better token efficiency than normal text
      expect(codeTokens).toBeLessThan(normalTokens);
    });

    it("inline code is also calculated efficiently", () => {
      const normalText = "Use the payment method";
      const inlineCodeText = "Use the `payment` method";

      const normalTokens = TokenEstimator.estimate(normalText);
      const inlineCodeTokens = TokenEstimator.estimate(inlineCodeText);

      // Difference should be small (inline code is short)
      expect(Math.abs(inlineCodeTokens - normalTokens)).toBeLessThan(5);
    });
  });

  describe("URL handling", () => {
    it("URLs are calculated with appropriate token count", () => {
      const textWithUrl =
        "Visit https://docs.tosspayments.com/guides for more info";
      const textWithoutUrl = "Visit the documentation for more info";

      const urlTokens = TokenEstimator.estimate(textWithUrl);
      const normalTokens = TokenEstimator.estimate(textWithoutUrl);

      // Text with URL should have more tokens
      expect(urlTokens).toBeGreaterThan(normalTokens);
    });
  });

  describe("Markdown header handling", () => {
    it("markdown headers have weight applied", () => {
      const normalText = "Payment Integration";
      const headerText = "# Payment Integration";

      const normalTokens = TokenEstimator.estimate(normalText);
      const headerTokens = TokenEstimator.estimate(headerText);

      // Headers should have some additional weight
      expect(headerTokens).toBeGreaterThan(normalTokens);
    });
  });

  describe("Complex text handling", () => {
    it("handles TossPayments documentation style text", () => {
      const complexText = `
# 결제 연동 가이드

토스페이먼츠 \`Payment\` 객체를 사용하여 결제를 연동합니다.

\`\`\`javascript
const payment = new Payment({
  clientKey: "test_ck_...",
  customerKey: "customer_123"
});
\`\`\`

자세한 내용은 https://docs.tosspayments.com 을 참조하세요.
      `;

      const tokens = TokenEstimator.estimate(complexText);

      // Complex text should be estimated within reasonable range
      expect(tokens).toBeGreaterThan(50);
      expect(tokens).toBeLessThan(200);
    });
  });

  describe("Utility methods", () => {
    it("calculates total tokens for multiple texts", () => {
      const texts = ["Hello", "World", "Test"];
      const total = TokenEstimator.estimateTotal(texts);
      const individual = texts.reduce(
        (sum, text) => sum + TokenEstimator.estimate(text),
        0
      );

      expect(total).toBe(individual);
    });

    it("checks if token limit is exceeded", () => {
      const shortText = "Hello";
      const longText = "A".repeat(1000);

      expect(TokenEstimator.exceedsLimit(shortText, 100)).toBe(false);
      expect(TokenEstimator.exceedsLimit(longText, 100)).toBe(true);
    });
  });
});
