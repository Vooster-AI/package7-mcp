#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BasePrompt } from "../constants/base-prompt.js";
import { GetDocumentSchema } from "../schema/get-document-schema.js";
import { DocumentByIdSchema } from "../schema/document-by-id-schema.js";
import {
  getLibraryList,
  getDocuments,
  getDocumentById,
} from "../tool/tools.js";

const server = new McpServer({
  name: "package7-mcp",
  description:
    "Universal MCP server for accessing library documentation. Enables LLM agents to retrieve documentation for any configured library and search through it using advanced text ranking. (다양한 라이브러리의 문서에 접근할 수 있는 범용 MCP 서버입니다. LLM Agent가 설정된 라이브러리의 문서를 검색하고 조회할 수 있게 합니다.)",
  version: "2.0.0",
});

server.tool(
  "get-library-list",
  "Returns the list of available library documentation sources. Use this to discover which libraries are supported before searching for documents.",
  {},
  async () => {
    return await getLibraryList();
  }
);

server.tool(
  "get-documents",
  `Searches and retrieves documentation for a specific library. Returns relevant document sections based on keyword matching using BM25 algorithm.

Usage:
1. Call get-library-list to see available libraries
2. Use the library ID when searching documents
3. Provide keywords related to what you're looking for

${BasePrompt}`,
  GetDocumentSchema,
  async (params) => {
    return await getDocuments(params);
  }
);

server.tool(
  "document-by-id",
  `Retrieves the complete content of a specific document by its ID within a library. The document ID is returned in search results from get-documents.`,
  DocumentByIdSchema,
  async (params) => {
    return await getDocumentById(params);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
