# TossPayments Integration Guide MCP

MCP-compatible toolset for integrating with TossPayments systems. Includes tools for retrieving LLM-structured text and fetching actual documentation through URLs.

토스페이먼츠 시스템과의 연동을 위한 MCP 도구 모음입니다. LLM이 활용할 수 있는 텍스트 및 관련 문서를 가져오는 기능을 포함합니다.

## Features

- **Document Search**: Search TossPayments documentation with keyword-based retrieval
- **Version Support**: Support for both V1 and V2 TossPayments APIs
- **BM25 Algorithm**: Advanced text ranking using BM25 algorithm
- **Markdown Processing**: Parse and process markdown documentation
- **Token Management**: Efficient token estimation and management for LLM contexts

## Installation

```bash
pnpm install
```

## Build

```bash
pnpm build
```

## Development

```bash
pnpm dev
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## Usage

The MCP server provides the following tools:

1. **get-v2-documents**: Retrieve TossPayments V2 documentation
2. **get-v1-documents**: Retrieve TossPayments V1 documentation
3. **document-by-id**: Get full document content by ID

## Project Structure

```
src/
├── constants/         # Configuration constants
├── document/          # Document processing logic
│   ├── splitter/     # Markdown splitting utilities
│   └── __test__/     # Document tests
├── repository/        # Data access layer
├── schema/           # Zod schemas
├── tool/             # MCP tool implementations
└── server.ts         # Main server entry point
```

## Scripts

- `pnpm build` - Build the project
- `pnpm dev` - Development mode with watch
- `pnpm start` - Start the MCP server
- `pnpm test` - Run tests
- `pnpm lint` - Lint code
- `pnpm format` - Format code with Prettier

## License

MIT
