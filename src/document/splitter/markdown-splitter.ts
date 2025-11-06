import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { TokenEstimator } from "../token-estimator.js";
import { DocumentMetadata } from "../types.js";
import { extractMetadata } from "./extractMetadata.js";
import { MarkdownTableBuilder } from "./markdown-table.builder.js";
import { CodeNodeParser } from "./parser/code-node-parser.js";
import { HeadingNodeParser } from "./parser/heading-node-parser.js";
import { InlineCodeNodeParser } from "./parser/inline-code-node-parser.js";
import { ParagraphNodeParser } from "./parser/paragraph-node-parser.js";
import { TextNodeParser } from "./parser/text-node-parser.js";
import {
  BaseNode,
  EnhancedChunk,
  NodeParser,
  NodeParserContext,
  NodeType,
  TableNodes,
} from "./types.js";

export class MarkdownSplitter {
  private readonly chunks: EnhancedChunk[] = [];
  private readonly buffer: string[] = [];

  private readonly context: NodeParserContext = {
    headingDepth: 4,
    headerStack: [],
  };

  private tableBuilder: MarkdownTableBuilder | null = null;

  constructor(
    private readonly markdown: string,
    private readonly metadata: DocumentMetadata,
    private readonly parsers: Map<NodeType, NodeParser>
  ) {
    this.context.headerStack.push(this.metadata.title);
  }

  static create(markdown: string) {
    const metadata = extractMetadata(markdown);

    const index = markdown.indexOf("-----");

    if (metadata.title !== "No Title" && index !== -1) {
      markdown = markdown.substring(index);
    }

    return new MarkdownSplitter(
      markdown,
      metadata,
      new Map(parsers.map((parser) => [parser.supportType, parser]))
    );
  }

  split() {
    const { parsers } = this;

    const tree = unified().use(remarkParse).parse(this.markdown);

    visit(tree, (node) => {
      if (this.isTableNodes(node)) {
        this.parseTableNodes(node);
        return;
      }

      // If tableBuilder exists but current node is not a table node
      if (this.tableBuilder) {
        this.clearTableBuilder();
      }

      const parser = parsers.get(node.type);

      if (!parser) {
        return;
      }

      const { value, finished } = parser.parse(node, this.context);

      if (finished) {
        this.flush();
      }

      this.append(value);
    });

    // Handle remaining table after visit is complete
    if (this.tableBuilder) {
      this.clearTableBuilder();
    }

    if (this.buffer.length > 0) {
      this.flush();
    }

    const additionalMetadata = this.chunks.find(
      (chunk) => !chunk.content.startsWith("#")
    );

    return {
      markdown: this.markdown,
      enhancedChunks: this.chunks, // New field added
      metadata: this.metadata,
      additionalMetadata: additionalMetadata?.content,
    };
  }

  private append(value: string) {
    this.buffer.push(value);
  }

  private parseTableNodes(node: TableNodes) {
    if (node.type === "table") {
      if (this.tableBuilder) {
        this.clearTableBuilder();
      }

      this.tableBuilder = new MarkdownTableBuilder();
    }

    if (node.type === "tableRow") {
      this.tableBuilder?.addRow();
    }

    if (node.type === "tableCell") {
      this.tableBuilder?.addColumn(node);
    }
  }

  private clearTableBuilder() {
    if (this.tableBuilder) {
      const tableText = this.tableBuilder.build();
      this.append(`\n${tableText}\n`);
      this.tableBuilder = null;
    }
  }

  private isTableNodes(node: BaseNode): node is TableNodes {
    return (
      node.type === "table" ||
      node.type === "tableCell" ||
      node.type === "tableRow"
    );
  }

  private flush() {
    const content = this.buffer.join(" ").trim();
    if (!content) return;

    // Copy current header stack (value copy, not reference)
    const currentHeaderStack = [...this.context.headerStack];

    // Pre-calculate estimated tokens
    const estimatedTokens = TokenEstimator.estimate(content);

    const enhancedChunk: EnhancedChunk = {
      content,
      headerStack: currentHeaderStack,
      estimatedTokens,
    };

    this.chunks.push(enhancedChunk);
    this.buffer.length = 0;

    // Header stack is managed by HeadingNodeParser, so don't pop here
  }
}

const parsers = [
  new HeadingNodeParser(),
  new InlineCodeNodeParser(),
  new CodeNodeParser(),
  new TextNodeParser(),
  new ParagraphNodeParser(),
];
