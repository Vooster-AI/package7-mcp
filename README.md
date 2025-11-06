# Package7 MCP

Universal MCP server for accessing library documentation. Enables LLM agents to retrieve documentation for any configured library and search through it using advanced text ranking.

다양한 라이브러리의 문서에 접근할 수 있는 범용 MCP 서버입니다. LLM Agent가 설정된 라이브러리의 문서를 검색하고 조회할 수 있게 합니다.

## Features

- **Multi-Library Support**: Access documentation for multiple configured libraries
- **Document Search**: Keyword-based document retrieval with BM25 ranking
- **BM25 Algorithm**: Advanced text ranking for precise search results
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

1. **get-library-list**: Retrieve available library list
2. **get-documents**: Search library documentation with keyword-based retrieval
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
