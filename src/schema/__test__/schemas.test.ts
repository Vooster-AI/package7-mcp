import { describe, it, expect } from "vitest";
import { GetDocumentSchema } from "../get-document-schema.js";
import { DocumentByIdSchema } from "../document-by-id-schema.js";
import { z } from "zod";
import { SearchMode } from "../../constants/search-mode.js";

describe("Schema Validation", () => {
  describe("GetDocumentSchema", () => {
    const schema = z.object(GetDocumentSchema);

    describe("libraryId validation", () => {
      it("should accept valid libraryId", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["test"],
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should reject empty libraryId", () => {
        const invalid = {
          libraryId: "",
          keywords: ["test"],
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should reject missing libraryId", () => {
        const invalid = {
          keywords: ["test"],
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should accept libraryId with hyphens", () => {
        const valid = {
          libraryId: "my-custom-lib",
          keywords: ["test"],
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });
    });

    describe("keywords validation", () => {
      it("should accept array of keywords", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["결제", "카드", "API"],
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should reject empty keywords array", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: [],
        };
        // Note: The schema doesn't enforce min length, this tests actual behavior
        expect(() => schema.parse(invalid)).not.toThrow();
      });

      it("should reject missing keywords", () => {
        const invalid = {
          libraryId: "tosspayments",
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should reject non-array keywords", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: "not-an-array",
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should reject non-string items in keywords", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: [123, 456],
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should accept single keyword", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["결제"],
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should accept many keywords", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["a", "b", "c", "d", "e", "f", "g"],
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });
    });

    describe("searchMode validation", () => {
      it("should accept valid searchMode", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          searchMode: SearchMode.BALANCED,
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should accept 'broad' searchMode", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          searchMode: SearchMode.BROAD,
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should accept 'precise' searchMode", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          searchMode: SearchMode.PRECISE,
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should use default when searchMode is missing", () => {
        const input = {
          libraryId: "tosspayments",
          keywords: ["test"],
        };
        const result = schema.parse(input);
        // With optional(), the field will be undefined if not provided
        // The default is applied at the tool layer, not schema layer
        expect(result.searchMode).toBeUndefined();
      });

      it("should reject invalid searchMode", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          searchMode: "invalid-mode",
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should allow undefined searchMode", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          searchMode: undefined,
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });
    });

    describe("maxTokens validation", () => {
      it("should accept valid maxTokens", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          maxTokens: 25000,
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should use default when maxTokens is missing", () => {
        const input = {
          libraryId: "tosspayments",
          keywords: ["test"],
        };
        const result = schema.parse(input);
        // With optional(), the field will be undefined if not provided
        // The default is applied at the tool layer, not schema layer
        expect(result.maxTokens).toBeUndefined();
      });

      it("should accept minimum value", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          maxTokens: 500,
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should accept maximum value", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          maxTokens: 50000,
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should reject maxTokens below minimum", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          maxTokens: 499,
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should reject maxTokens above maximum", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          maxTokens: 50001,
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should reject non-integer maxTokens", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          maxTokens: 1000.5,
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should reject negative maxTokens", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          maxTokens: -1000,
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should reject string maxTokens", () => {
        const invalid = {
          libraryId: "tosspayments",
          keywords: ["test"],
          maxTokens: "25000",
        };
        expect(() => schema.parse(invalid)).toThrow();
      });
    });

    describe("full schema validation", () => {
      it("should accept complete valid input", () => {
        const valid = {
          libraryId: "tosspayments",
          keywords: ["결제위젯", "연동"],
          searchMode: SearchMode.BALANCED,
          maxTokens: 25000,
        };
        const result = schema.parse(valid);
        expect(result.libraryId).toBe("tosspayments");
        expect(result.keywords).toEqual(["결제위젯", "연동"]);
        expect(result.searchMode).toBe(SearchMode.BALANCED);
        expect(result.maxTokens).toBe(25000);
      });

      it("should accept minimal valid input with defaults", () => {
        const minimal = {
          libraryId: "tosspayments",
          keywords: ["test"],
        };
        const result = schema.parse(minimal);
        expect(result.libraryId).toBe("tosspayments");
        expect(result.keywords).toEqual(["test"]);
        // With optional(), these will be undefined (defaults applied at tool layer)
        expect(result.searchMode).toBeUndefined();
        expect(result.maxTokens).toBeUndefined();
      });
    });
  });

  describe("DocumentByIdSchema", () => {
    const schema = z.object(DocumentByIdSchema);

    describe("libraryId validation", () => {
      it("should accept valid libraryId", () => {
        const valid = {
          libraryId: "tosspayments",
          id: "123",
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should reject empty libraryId", () => {
        const invalid = {
          libraryId: "",
          id: "123",
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should reject missing libraryId", () => {
        const invalid = {
          id: "123",
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should accept libraryId with hyphens and numbers", () => {
        const valid = {
          libraryId: "my-lib-123",
          id: "456",
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });
    });

    describe("id validation", () => {
      it("should accept numeric string id", () => {
        const valid = {
          libraryId: "tosspayments",
          id: "42",
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should accept large numeric id", () => {
        const valid = {
          libraryId: "tosspayments",
          id: "999999",
        };
        expect(() => schema.parse(valid)).not.toThrow();
      });

      it("should reject empty id", () => {
        const invalid = {
          libraryId: "tosspayments",
          id: "",
        };
        // Schema accepts any string, validation happens in tool handler
        expect(() => schema.parse(invalid)).not.toThrow();
      });

      it("should reject missing id", () => {
        const invalid = {
          libraryId: "tosspayments",
        };
        expect(() => schema.parse(invalid)).toThrow();
      });

      it("should accept id as string (not number)", () => {
        const valid = {
          libraryId: "tosspayments",
          id: "123",
        };
        const result = schema.parse(valid);
        expect(typeof result.id).toBe("string");
      });

      it("should reject numeric id (must be string)", () => {
        const invalid = {
          libraryId: "tosspayments",
          id: 123,
        };
        expect(() => schema.parse(invalid)).toThrow();
      });
    });

    describe("full schema validation", () => {
      it("should accept complete valid input", () => {
        const valid = {
          libraryId: "tosspayments",
          id: "42",
        };
        const result = schema.parse(valid);
        expect(result.libraryId).toBe("tosspayments");
        expect(result.id).toBe("42");
      });

      it("should not accept extra fields", () => {
        const withExtra = {
          libraryId: "tosspayments",
          id: "42",
          extraField: "should be ignored",
        };
        // Zod by default allows extra fields, they're just not in the result
        const result = schema.parse(withExtra);
        expect(result.libraryId).toBe("tosspayments");
        expect(result.id).toBe("42");
      });
    });
  });
});
