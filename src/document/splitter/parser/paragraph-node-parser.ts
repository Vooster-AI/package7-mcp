import { NodeParser, ParsedNode } from "../types.js";

export class ParagraphNodeParser implements NodeParser {
  supportType = "paragraph" as const;

  parse(): ParsedNode {
    // Add line break at the end of paragraph (existing processParagraphNode logic)
    return {
      value: "\n", // Add blank line to separate paragraphs
      finished: false,
    };
  }
}
