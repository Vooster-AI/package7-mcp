import { beforeEach, describe, expect, it } from "vitest";
import { HeadingNodeParser } from "../splitter/parser/heading-node-parser.js";
import { HeadingNode, NodeParserContext } from "../splitter/types.js";

describe("HeadingNodeParser", () => {
  let parser: HeadingNodeParser;
  let context: NodeParserContext;

  beforeEach(() => {
    parser = new HeadingNodeParser();
    context = {
      headingDepth: 3,
      headerStack: [],
    };
  });

  describe("Basic header parsing", () => {
    it("parses simple headers", () => {
      const node: HeadingNode = {
        type: "heading",
        depth: 1,
        children: [{ type: "text", value: "결제 연동" }],
      };

      const result = parser.parse(node, context);

      expect(result.value).toBe("\n\n# 결제 연동\n");
      expect(result.finished).toBe(true);
      expect(context.headerStack).toEqual(["결제 연동"]);
    });

    it("handles empty headers", () => {
      const node: HeadingNode = {
        type: "heading",
        depth: 2,
        children: [],
      };

      const result = parser.parse(node, context);

      expect(result.value).toBe("\n\n## \n");
      expect(result.finished).toBe(true);
      expect(context.headerStack).toEqual([undefined, ""]);
    });
  });

  describe("Header stack management", () => {
    it("manages hierarchical header structure correctly", () => {
      // H1: Payment integration
      const h1: HeadingNode = {
        type: "heading",
        depth: 1,
        children: [{ type: "text", value: "결제 연동" }],
      };
      parser.parse(h1, context);
      expect(context.headerStack).toEqual(["결제 연동"]);

      // H2: Card payment
      const h2: HeadingNode = {
        type: "heading",
        depth: 2,
        children: [{ type: "text", value: "카드 결제" }],
      };
      parser.parse(h2, context);
      expect(context.headerStack).toEqual(["결제 연동", "카드 결제"]);

      // H3: Authenticated payment
      const h3: HeadingNode = {
        type: "heading",
        depth: 3,
        children: [{ type: "text", value: "인증 결제" }],
      };
      parser.parse(h3, context);
      expect(context.headerStack).toEqual([
        "결제 연동",
        "카드 결제",
        "인증 결제",
      ]);
    });

    it("cleans stack when moving from deeper to shallower headers", () => {
      // Initial state: H1 > H2 > H3
      context.headerStack = ["결제 연동", "카드 결제", "인증 결제"];

      // When new H2 appears, H3 should be removed
      const newH2: HeadingNode = {
        type: "heading",
        depth: 2,
        children: [{ type: "text", value: "가상계좌 결제" }],
      };
      parser.parse(newH2, context);

      expect(context.headerStack).toEqual(["결제 연동", "가상계좌 결제"]);
    });

    it("resets stack when moving from one H1 to another H1", () => {
      // Initial state: complex header structure
      context.headerStack = ["결제 연동", "카드 결제", "인증 결제"];

      // New H1
      const newH1: HeadingNode = {
        type: "heading",
        depth: 1,
        children: [{ type: "text", value: "웹훅 연동" }],
      };
      parser.parse(newH1, context);

      expect(context.headerStack).toEqual(["웹훅 연동"]);
    });

    it("handles skipped header levels", () => {
      // H1 > H3 (skipping H2)
      const h1: HeadingNode = {
        type: "heading",
        depth: 1,
        children: [{ type: "text", value: "결제 연동" }],
      };
      parser.parse(h1, context);

      const h3: HeadingNode = {
        type: "heading",
        depth: 3,
        children: [{ type: "text", value: "인증 결제" }],
      };
      parser.parse(h3, context);

      // H2 position is undefined, H3 is added normally
      expect(context.headerStack).toEqual([
        "결제 연동",
        undefined,
        "인증 결제",
      ]);
    });
  });

  describe("headingDepth limit", () => {
    it("headers deeper than headingDepth have finished as false", () => {
      context.headingDepth = 2;

      const h3: HeadingNode = {
        type: "heading",
        depth: 3,
        children: [{ type: "text", value: "세부 내용" }],
      };

      const result = parser.parse(h3, context);

      expect(result.finished).toBe(false);
      expect(context.headerStack).toEqual([]); // Not added to stack
    });

    it("headers equal to or shallower than headingDepth have finished as true", () => {
      context.headingDepth = 3;

      const h2: HeadingNode = {
        type: "heading",
        depth: 2,
        children: [{ type: "text", value: "섹션" }],
      };

      const result = parser.parse(h2, context);

      expect(result.finished).toBe(true);
      expect(context.headerStack).toEqual([undefined, "섹션"]);
    });
  });

  describe("Complex header text", () => {
    it("handles headers with links", () => {
      const node: HeadingNode = {
        type: "heading",
        depth: 2,
        children: [
          { type: "text", value: "결제 " },
          {
            type: "link",
            url: "https://example.com",
            children: [{ type: "text", value: "API" }],
          },
          { type: "text", value: " 가이드" },
        ],
      };

      const result = parser.parse(node, context);

      expect(result.value).toContain("## 결제 API 가이드");
      expect(context.headerStack[1]).toBe("결제 API 가이드");
    });

    it("handles headers with inline code", () => {
      const node: HeadingNode = {
        type: "heading",
        depth: 2,
        children: [
          { type: "text", value: "Payment " },
          { type: "inlineCode", value: "객체" },
          { type: "text", value: " 사용법" },
        ],
      };

      const result = parser.parse(node, context);

      expect(result.value).toContain("## Payment 객체 사용법");
      expect(context.headerStack[1]).toBe("Payment 객체 사용법");
    });
  });
});
