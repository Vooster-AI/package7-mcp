# Documentation Index MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Package Manager](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-orange)](https://pnpm.io/)

Universal MCP (Model Context Protocol) server for accessing and searching library documentation. Enables LLM agents to retrieve and analyze documentation for any configured library using advanced text ranking algorithms.

## Features

- **Multi-Library Support**: Access documentation for multiple configured libraries simultaneously
- **Advanced Search**: Keyword-based document retrieval with BM25 ranking algorithm for precise results
- **Intelligent Document Processing**: Parse and process markdown documentation with token estimation
- **Semantic Chunking**: Split documents into semantically meaningful chunks for better context management
- **Token Management**: Efficient token counting and management for LLM context windows
- **Metadata Extraction**: Automatic extraction of document structure and metadata (headings, code blocks, tables)
- **Category-Based Weighting**: Intelligent ranking based on document categories and sections
- **Flexible Configuration**: Support for multiple search modes and customizable keyword weighting
- **Built with TypeScript**: Full type safety and comprehensive test coverage

## Installation

### NPM

```bash
npm install -g package7-mcp
```

### Smithery

To install Documentation Index MCP Server for any client automatically via [Smithery](https://smithery.ai):

```bash
npx -y @smithery/cli@latest install package7-mcp --client <CLIENT_NAME>
```

Available clients: `cursor`, `claude`, `vscode`, `windsurf`, `cline`, `zed`, etc.

**Example for Cursor:**

```bash
npx -y @smithery/cli@latest install package7-mcp --client cursor
```

### From Source

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run the server
pnpm start
```

## MCP Client Integration

Documentation Index MCP can be integrated with various AI coding assistants and IDEs that support the Model Context Protocol (MCP).

### Requirements

- Node.js >= v18.0.0
- pnpm >= v8.0.0
- An MCP-compatible client (Cursor, Claude Code, VS Code, Windsurf, etc.)

<details>
<summary><b>Install in Cursor</b></summary>

Go to: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`

Add the following configuration to your `~/.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "docs-index": {
      "command": "npx",
      "args": ["-y", "package7-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Run this command:

```sh
claude mcp add docs-index -- npx -y package7-mcp
```

</details>

<details>
<summary><b>Install in VS Code</b></summary>

Add this to your VS Code MCP config file. See [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more info.

```json
"mcp": {
  "servers": {
    "docs-index": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "package7-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Windsurf</b></summary>

Add this to your Windsurf MCP config file:

```json
{
  "mcpServers": {
    "docs-index": {
      "command": "npx",
      "args": ["-y", "package7-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Cline</b></summary>

1. Open **Cline**
2. Click the hamburger menu icon (☰) to enter the **MCP Servers** section
3. Choose **Remote Servers** tab
4. Click the **Edit Configuration** button
5. Add docs-index to `mcpServers`:

```json
{
  "mcpServers": {
    "docs-index": {
      "command": "npx",
      "args": ["-y", "package7-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Claude Desktop</b></summary>

Open Claude Desktop developer settings and edit your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "docs-index": {
      "command": "npx",
      "args": ["-y", "package7-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Zed</b></summary>

Add this to your Zed `settings.json`:

```json
{
  "context_servers": {
    "docs-index": {
      "source": "custom",
      "command": "npx",
      "args": ["-y", "package7-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Roo Code</b></summary>

Add this to your Roo Code MCP configuration file:

```json
{
  "mcpServers": {
    "docs-index": {
      "command": "npx",
      "args": ["-y", "package7-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Using with Bun</b></summary>

```json
{
  "mcpServers": {
    "docs-index": {
      "command": "bunx",
      "args": ["-y", "package7-mcp"]
    }
  }
}
```

</details>

## Usage

The MCP server provides the following tools:

### get-library-list

Retrieve the list of available libraries and their metadata.

**Parameters:** None

**Returns:**
```json
{
  "libraries": [
    {
      "id": "react",
      "name": "React",
      "version": "18.0.0",
      "description": "A JavaScript library for building user interfaces"
    }
  ]
}
```

### get-documents

Search library documentation with keyword-based retrieval using BM25 ranking algorithm.

**Parameters:**
```json
{
  "libraryId": "react",
  "query": "hooks state management",
  "limit": 10
}
```

**Returns:** Array of documents with scores and metadata:
```json
{
  "documents": [
    {
      "id": "doc-123",
      "title": "Using the State Hook",
      "content": "...",
      "score": 0.95,
      "metadata": {
        "section": "Hooks",
        "category": "Advanced"
      }
    }
  ]
}
```

### document-by-id

Get full document content by ID.

**Parameters:**
```json
{
  "documentId": "doc-123"
}
```

**Returns:**
```json
{
  "id": "doc-123",
  "title": "Using the State Hook",
  "content": "Complete document content...",
  "metadata": {
    "tokens": 1250,
    "section": "Hooks"
  }
}
```

## Usage Examples

### Example 1: Search for documentation

**In Cursor/Claude Code:**
```
Search for React documentation about hooks and find examples of useState usage
```

### Example 2: Get specific library information

**In any MCP client:**
```
What libraries are available and show me the latest React documentation
```

### Example 3: Analyze code patterns

**In Cursor/Claude Code:**
```
I need to understand how to manage state in React.
Search the React documentation for state management patterns.
```

## Architecture

The project follows a modular architecture:

- **constants/**: Configuration constants and base prompts
- **document/**: Document processing logic
  - **splitter/**: Markdown parsing and document chunking utilities
  - **parser/**: Specialized parsers for different node types
- **repository/**: Data access layer and document repositories
- **schema/**: Zod schemas for runtime type validation
- **tool/**: MCP tool implementations
- **server.ts**: Main server entry point

### Core Components

- **MarkdownSplitter**: Intelligent markdown document splitting with semantic awareness
- **BM25Calculator**: Advanced ranking algorithm for search relevance
- **TokenEstimator**: Efficient token counting for context management
- **DocumentLoader**: Flexible document loading and caching
- **ChunkConverter**: Conversion between different document formats

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode (watch mode)
pnpm dev

# Type check
pnpm typecheck
```

### Building

```bash
pnpm build
```

### Code Quality

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code with Prettier
pnpm format
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

The project includes comprehensive test coverage for:
- Document processing and parsing
- BM25 ranking algorithm
- Token estimation
- Search functionality
- Repository operations

## Project Structure

```
src/
├── constants/              # Configuration constants and prompts
│   ├── base-prompt.ts      # Base system prompts
│   ├── category.ts         # Category definitions
│   ├── keyword-weight-config.ts # Search weight configuration
│   └── search-mode.ts      # Search mode definitions
├── document/               # Document processing logic
│   ├── splitter/           # Markdown splitting utilities
│   │   ├── markdown-splitter.ts  # Main splitter
│   │   ├── parser/         # Node-type specific parsers
│   │   └── extractMetadata.ts    # Metadata extraction
│   ├── token-estimator.ts  # Token counting
│   ├── document-loader.ts  # Document loading
│   ├── chunk-converter.ts  # Format conversion
│   └── __test__/           # Document tests
├── repository/             # Data access layer
│   ├── docs.repository.ts  # Document repository
│   └── createDocsRepository.ts # Factory function
├── schema/                 # Zod schemas
│   └── get-document-schema.ts   # Request schemas
├── tool/                   # MCP tool implementations
│   └── tools.ts            # Tool definitions
└── server.ts               # Main server entry point
```

## Configuration

### Search Modes

The server supports multiple search modes configured via constants:

- **BM25**: Advanced relevance ranking (default)
- **Keyword**: Simple keyword matching
- **Semantic**: Context-aware search

### Category Weighting

Documents can be weighted by category for better ranking:

```typescript
const categoryWeights = {
  'Getting Started': 1.2,
  'API': 1.0,
  'Examples': 0.9
};
```

## Scripts

- `pnpm build` - Build the project with TypeScript
- `pnpm dev` - Development mode with watch
- `pnpm start` - Start the MCP server
- `pnpm test` - Run all tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Generate coverage report
- `pnpm lint` - Lint code with ESLint
- `pnpm lint:fix` - Fix linting issues
- `pnpm format` - Format code with Prettier
- `pnpm typecheck` - Type check without building

## Docker Support

### Build Docker Image

```bash
docker build -t package7-mcp .
```

### Run with Docker

```bash
docker run -d -p 3000:3000 \
  --name docs-index \
  package7-mcp
```

### Docker Compose Example

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  docs-index:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/mcp', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Run with Docker Compose:

```bash
docker-compose up -d
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

choesumin
