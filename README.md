# PolyAgent MCP Server

PolyAgent is an MCP (Model Context Protocol) server that bridges AI coding assistants with the OPA (Open Policy Agent) ecosystem. It augments AI tools with domain-specific capabilities for policy-as-code development.

## Features

- **Interactive Policy Debugging**: Conversational OPA policy evaluation and trace explanation
- **Policy Example Search**: RAG-powered semantic search over curated policy repositories
- **Framework Requirements Lookup**: Instant access to security framework requirements (OpenSSF SLSA, CIS, NIST)

## Quick Start

**Requirements:**
- Node.js >=22.0.0 (v24.11.0 LTS or v22.11.0 LTS recommended)
- npm

**Installation:**
```bash
npm install -g @polyagent/mcp-server
```

**Setup:**
```bash
polyagent-mcp setup
```

## Development

**Build:**
```bash
npm run build
```

**Test:**
```bash
npm test
```

**Lint:**
```bash
npm run lint
```

**Watch mode:**
```bash
npm run dev
```

## License

Apache 2.0 - See LICENSE file for details.

## Project Status

This project is under active development. Current implementation focuses on the MVP delivering three core MCP tools for policy development workflows.
