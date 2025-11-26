# PolyAgent MCP Server

PolyAgent is an MCP (Model Context Protocol) server that bridges AI coding assistants with the OPA (Open Policy Agent) ecosystem. It augments AI tools with domain-specific capabilities for policy-as-code development.

## Features

- **Interactive Policy Debugging**: Conversational OPA policy evaluation and trace explanation
- **Policy Example Search**: RAG-powered semantic search over curated policy repositories
- **Framework Requirements Lookup**: Instant access to security framework requirements (OpenSSF SLSA, CIS, NIST)
- **Zero-Config Setup**: Interactive wizard configures your environment automatically

## Quick Start

### Installation

Install PolyAgent globally via npm:

```bash
npm install -g @polyagent/mcp-server
```

### Setup

Run the setup wizard to configure PolyAgent and connect it to your AI tools:

```bash
polyagent-mcp setup
```

The wizard will:
1. Detect installed AI tools (Claude Code, Cursor).
2. Ask for your OpenAI API key (optional, for RAG search features).
3. Automatically configure Claude Code (if installed).
4. Provide configuration instructions for Cursor.

### Verification

Verify that everything is working correctly:

```bash
polyagent-mcp verify
```

### Health Check

Check the status of the MCP server components:

```bash
polyagent-mcp health
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
