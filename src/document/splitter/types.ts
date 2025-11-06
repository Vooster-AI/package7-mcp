export interface BaseNode {
  type: string;
  children?: ASTNode[];
}

export interface TextNode extends BaseNode {
  type: "text";
  value: string;
}

export interface HeadingNode extends BaseNode {
  type: "heading";
  depth: number;
  children: ASTNode[];
}

export interface CodeNode extends BaseNode {
  type: "code";
  value: string;
  lang?: string | null;
}

export interface InlineCodeNode extends BaseNode {
  type: "inlineCode";
  value: string;
}

export interface LinkNode extends BaseNode {
  type: "link";
  url: string;
  children: ASTNode[];
}

export interface TableNode extends BaseNode {
  type: "table";
  children: TableRowNode[];
}

export interface TableRowNode extends BaseNode {
  type: "tableRow";
  children: TableCellNode[];
}

export interface TableCellNode extends BaseNode {
  type: "tableCell";
  children: ASTNode[];
}

export interface ParagraphNode extends BaseNode {
  type: "paragraph";
  children: ASTNode[];
}

export interface ListItemNode extends BaseNode {
  type: "listItem";
  children: ASTNode[];
  value?: string;
}

export type ASTNode =
  | TextNode
  | HeadingNode
  | CodeNode
  | InlineCodeNode
  | LinkNode
  | TableNode
  | TableRowNode
  | TableCellNode
  | ParagraphNode
  | ListItemNode
  | BaseNode; // fallback for unknown nodes

export type NodeType = ASTNode["type"];

export type TableNodes = TableNode | TableRowNode | TableCellNode;

export type ParsedNode = { value: string; finished: boolean };

export type NodeParserContext = {
  headingDepth: number;
  headerStack: string[];
};

/**
 * Enhanced chunk structure with context information
 */
export interface EnhancedChunk {
  content: string; // Original content
  headerStack: string[]; // ["Payment Integration", "Card Payment", "Authentication Payment"]
  estimatedTokens: number; // Pre-calculated token count
}

export interface NodeParser {
  supportType: NodeType;
  parse(node: ASTNode, context: NodeParserContext): ParsedNode;
}
