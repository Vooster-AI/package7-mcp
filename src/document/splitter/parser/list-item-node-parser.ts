import { ListItemNode, NodeParser, ParsedNode } from "../types.js";
import { extractTextFromNode } from "../extractTextFromNode.js";

export class ListItemNodeParser implements NodeParser {
  supportType = "listItem" as const;

  parse(node: ListItemNode): ParsedNode {
    // Process list items (improved from existing processListItemNode logic)
    const itemText = extractTextFromNode(node);

    return {
      value: `\n\n* ${itemText}\n`,
      finished: false,
    };
  }
}
