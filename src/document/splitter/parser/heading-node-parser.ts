import { extractTextFromNode } from "../extractTextFromNode.js";
import {
  HeadingNode,
  NodeParser,
  NodeParserContext,
  ParsedNode,
} from "../types.js";

/**
 * Enhanced heading node parser with support for hierarchical header stack management
 * Accurately tracks and manages the hierarchy of markdown headings.
 */
export class HeadingNodeParser implements NodeParser {
  supportType = "heading" as const;

  parse(node: HeadingNode, context: NodeParserContext): ParsedNode {
    const cleanHeaderText = this.extractCleanHeaderText(node);
    const markdownValue = this.formatMarkdownHeader(node, cleanHeaderText);

    const finished = node.depth <= context.headingDepth;

    if (finished) {
      // Update header stack considering hierarchy
      this.updateHeaderStack(context, node.depth, cleanHeaderText);
    }

    return { value: markdownValue, finished };
  }

  /**
   * Extract pure header text with markdown formatting removed
   * @param node Heading node
   * @returns Clean header text
   */
  private extractCleanHeaderText(node: HeadingNode): string {
    if (node.children && node.children.length > 0) {
      return extractTextFromNode(node).trim();
    }
    return "";
  }

  /**
   * Format header as markdown
   * @param node Heading node
   * @param text Header text
   * @returns Formatted markdown header
   */
  private formatMarkdownHeader(node: HeadingNode, text: string): string {
    const headingPrefix = "#".repeat(node.depth);
    return text ? `\n\n${headingPrefix} ${text}\n` : `\n\n${headingPrefix} \n`;
  }

  /**
   * Update header stack considering hierarchy
   * Remove headers deeper than current depth and add new header
   * @param context Parser context
   * @param depth Current header depth
   * @param headerText Clean header text
   */
  private updateHeaderStack(
    context: NodeParserContext,
    depth: number,
    headerText: string
  ): void {
    // Remove headers deeper than current depth
    // Example: If depth 2 header appears, remove all existing headers with depth 2, 3, 4...
    while (context.headerStack.length >= depth) {
      context.headerStack.pop();
    }

    // Add new header at appropriate position
    // headerStack[0] = depth 1, headerStack[1] = depth 2, ...
    context.headerStack[depth - 1] = headerText;

    // Remove undefined elements after depth
    context.headerStack.length = depth;
  }
}
