import { BaseNode } from "./types.js";

/**
 * Function to extract text content from a node
 */
export function extractTextFromNode(node: BaseNode): string {
  if (isTextValue(node)) {
    return node.value.trim();
  }

  if (node.children && Array.isArray(node.children)) {
    return node.children
      .map((child: any) => extractTextFromNode(child))
      .join(" ")
      .trim();
  }

  return "";
}

function isTextValue(
  node: BaseNode | (BaseNode & { value: unknown })
): node is BaseNode & { value: string } {
  return (
    (node.type === "text" ||
      node.type === "inlineCode" ||
      node.type === "code") &&
    "value" in node &&
    typeof node.value === "string"
  );
}
