import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BasePrompt, BasePromptForV1 } from "./constants/base-prompt.js";
import { GetDocumentSchema } from "./schema/get-document-schema.js";
import {
  getDocumentById,
  getV1DocumentsByKeyword,
  getV2DocumentsByKeyword,
} from "./tool/tools.js";


const server = new McpServer({
  name: "package7-mcp",
  description:
    "Universal MCP server for accessing library documentation. Enables LLM agents to retrieve documentation for any configured library and search through it using advanced text ranking. (다양한 라이브러리의 문서에 접근할 수 있는 범용 MCP 서버입니다. LLM Agent가 설정된 라이브러리의 문서를 검색하고 조회할 수 있게 합니다.)",
  version: "1.0.0",
});

server.tool(
  "get-v2-documents",
  `V2 documents를 조회합니다. 명시적으로 유저가 버전에 관련된 질의가 없다면 사용해주세요.
${BasePrompt}`,
  GetDocumentSchema,
  async (params) => {
    return await getV2DocumentsByKeyword(params);
  }
);

server.tool(
  "get-v1-documents",
  `V1 documents를 조회합니다. 명시적으로 유저가 버전1을 질의하는 경우 사용해주세요.
${BasePromptForV1}`,
  GetDocumentSchema,
  async (params) => {
    return await getV1DocumentsByKeyword(params);
  }
);

server.tool(
  "document-by-id",
  `문서의 원본 ID 로 해당 문서의 전체 내용을 조회합니다.`,
  { id: z.string().describe("문서별 id 값") },
  async ({ id }) => {
    return await getDocumentById(id);
  }
);

const transport = new StdioServerTransport();

await server.connect(transport);
