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

## MCP Tools Reference

### `explain_policy_decision`

Evaluates an OPA policy with input data and returns a detailed trace showing which rules fired. Use this to debug policy decisions and understand why a request was allowed or denied.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `policyPath` | string | Yes | Path to the Rego policy file (`.rego`) |
| `inputData` | string | Yes | JSON string containing the input data for evaluation |
| `packageName` | string | No | Package name to target (auto-detected if not provided) |
| `ruleName` | string | No | Rule name to evaluate (defaults to `allow`) |

**Example Input:**

```json
{
  "policyPath": "examples/policies/rbac-simple.rego",
  "inputData": "{\"user\": {\"role\": \"viewer\"}, \"action\": \"write\", \"resource\": {\"type\": \"document\"}}"
}
```

**Output Format:**

```json
{
  "result": false,
  "trace": [
    { "rule": "allow", "line": 21, "result": "false" },
    { "rule": "allow", "line": 27, "result": "false" }
  ],
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `result` | boolean/object/null | The evaluation result (`true` = allowed, `false` = denied) |
| `trace` | array | Array of rule evaluations showing which rules were checked |
| `error` | object/null | Error details if evaluation failed |

**Common Use Cases:**

- Debug why a policy denied a request
- Understand which rules were evaluated
- Verify policy behavior before deployment
- Learn OPA by seeing evaluation traces

See [`examples/debug-why-deny.md`](examples/debug-why-deny.md) for a complete tutorial.

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
