# Epic Technical Specification: Foundation & MCP Server Core

Date: 2025-11-19
Author: ianhundere
Epic ID: epic-1
Status: Draft

---

## Overview

Epic 1 establishes the foundational infrastructure for PolyAgent MCP server. This includes TypeScript/Node.js project setup with MCP SDK integration, core MCP server implementation with tool registration capabilities, configuration management system, structured logging and health monitoring, embedded framework data loading, and npm package distribution with installation wizard.

This epic delivers zero policy assistance functionality but creates the complete runtime environment required by all subsequent epics (Debugging, RAG Search, Framework Lookup, Error Handling). Without Epic 1, no MCP tools can be implemented.

---

## Objectives and Scope

**In Scope:**
- TypeScript/Node.js project with verified dependencies (Node 24 LTS, TypeScript 5.9.3, MCP SDK 1.22.0, OPA WASM 1.10.0)
- MCP server accepting stdio connections from AI tools (Claude Code, Cursor)
- JSON configuration system at `~/.polyagent/config.json` with environment variable overrides
- Structured logging (pino/winston) with file rotation and debug mode
- Health check command verifying all components
- Embedded framework YAML data (SLSA, CIS, NIST) with validation
- npm package (@polyagent/mcp-server) with global install and setup wizard

**Out of Scope (Future Epics):**
- MCP tool implementations (Epics 2-4)
- Policy evaluation, RAG search, framework lookups (deferred to tool epics)
- Error recovery strategies beyond basic logging (Epic 5)

**Success Criteria:**
- `npm install -g @polyagent/mcp-server` succeeds
- `polyagent-mcp setup` wizard completes configuration
- `polyagent-mcp verify` confirms server starts and connects to MCP client
- `polyagent-mcp health` reports all components initialized
- Claude Code/Cursor can establish MCP connection
- Server responds to `tools/list` with empty array (tools added in later epics)

---

## System Architecture Alignment

**Architecture References:**
- ADR-004 (lines 228-241): MCP Protocol over CLI/REST API - stdio transport, JSON-RPC
- ADR-005 (lines 242-253): TypeScript over Go/Python - MCP SDK native, npm ecosystem
- Component Diagram (lines 31-87): MCP Server Core position in system
- npm Package Structure (lines 447-460): Directory layout, entry points
- Deployment Architecture (lines 441-494): Installation flow, AI tool configuration

**Architectural Constraints:**
- Must use @modelcontextprotocol/sdk@1.22.0 (verified version)
- Must support stdio transport (MCP standard for local tools)
- Must load config from `~/.polyagent/config.json` (architecture lines 346-377)
- Must embed framework YAML in npm package (ADR-003, lines 209-227)
- Must support Node.js v24 LTS or v22 LTS (verified, lines 21-29)

---

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|----------------|--------|---------|-------|
| **src/server.ts** | MCP server entry point, tool registration, connection lifecycle | MCP JSON-RPC messages via stdio | MCP responses, tool list | Story 1.2 |
| **src/lib/config-manager.ts** | Load/validate config, env var overrides, export config | Config file path, env vars | ConfigObject, validation errors | Story 1.3 |
| **src/lib/logger.ts** | Structured logging, file rotation, debug mode | Log messages, level, component | Formatted logs to stdout/file | Story 1.4 |
| **src/lib/framework-store.ts** | Load/validate framework YAML, query requirements | Framework ID, requirement ID | Requirement object, validation errors | Story 1.5 |
| **src/lib/health-check.ts** | Component health verification | Component states | Health status report | Story 1.4 |
| **bin/polyagent-mcp** | CLI entry point (setup, verify, health, version commands) | CLI args | Command outputs, exit codes | Story 1.6 |

**Module Dependencies:**
- server.ts → config-manager, logger, framework-store
- All modules → logger (for logging)
- CLI → server (for verify command), config-manager (for setup), health-check

---

### Data Models and Contracts

**ConfigObject Schema:**
```typescript
interface PolyAgentConfig {
  version: string;                    // Config schema version
  embedding: {
    provider: "openai";
    apiKey: string;                   // From env var or config
    model: "text-embedding-3-small";
  };
  policyExamples: {
    repos: PolicyRepo[];
    updateInterval: string;           // e.g., "7d"
  };
  opa: {
    engine: "wasm" | "binary";
    binaryPath?: string;
  };
  logging: {
    level: "error" | "warn" | "info" | "debug";
    file?: string;                    // Optional log file path
  };
}

interface PolicyRepo {
  name: string;
  url?: string;                       // GitHub URL
  path?: string;                      // Local file path
  enabled: boolean;
}
```
Source: Architecture lines 346-377

**Framework YAML Schema:**
```yaml
framework:
  id: string                # e.g., "openssf-slsa"
  name: string              # e.g., "OpenSSF SLSA"
  version: string           # e.g., "1.0"
  url: string               # Official docs URL

requirements:
  - id: string              # e.g., "level-3"
    title: string
    description: string
    rationale: string
    controls: string[]
    references: string[]
```
Source: Architecture lines 379-410

**Health Status Schema:**
```typescript
interface HealthStatus {
  server: ComponentHealth;
  opa: ComponentHealth;
  rag: ComponentHealth;
  config: ComponentHealth;
  frameworks: ComponentHealth;
}

interface ComponentHealth {
  status: "healthy" | "degraded" | "unavailable";
  message?: string;
  details?: Record<string, any>;
}
```

---

### APIs and Interfaces

**MCP Protocol Interface (stdio):**

Server listens on stdin, writes to stdout (JSON-RPC format per MCP spec).

**Handshake Flow:**
```
Client → Server: initialize request
Server → Client: initialize response with capabilities
Client → Server: initialized notification
Server: Ready for tool calls

Client → Server: tools/list request
Server → Client: tools/list response (empty array in Epic 1)
```

**Configuration CLI:**

```bash
# Setup wizard
polyagent-mcp setup
Inputs: Interactive prompts (OpenAI API key, AI tool selection)
Output: ~/.polyagent/config.json created, AI tool config updated, exit code 0

# Config validation
polyagent-mcp validate-config
Inputs: None (reads ~/.polyagent/config.json)
Output: Validation results, exit code 0/1

# Health check
polyagent-mcp health
Inputs: None (queries running server or checks installation)
Output: Component health status, exit code 0/1

# Verify installation
polyagent-mcp verify
Inputs: None (runs test queries)
Output: Test results for all components, exit code 0/1

# Version
polyagent-mcp version
Output: v{major}.{minor}.{patch}
```

**Framework Store API (Internal):**

```typescript
class FrameworkStore {
  listFrameworks(): string[];
  // Returns: ["openssf-slsa", "cis-kubernetes", "nist-800-190"]

  getRequirement(frameworkId: string, requirementId: string): Requirement;
  // Returns: Requirement object or throws NotFoundError

  listRequirements(frameworkId: string): string[];
  // Returns: All requirement IDs for framework

  validateYAML(yamlPath: string): ValidationResult;
  // Returns: { valid: boolean, errors: string[] }
}
```

---

### Workflows and Sequencing

**Installation & Setup Flow:**

```
User: npm install -g @polyagent/mcp-server
  ↓
npm: Downloads package, links bin/polyagent-mcp to PATH
  ↓
User: polyagent-mcp setup
  ↓
Setup Wizard:
  1. Detect AI tools (check ~/.claude, ~/.cursor)
  2. Prompt: "Enter OpenAI API key (for RAG):"
  3. Prompt: "Configure for: [1] Claude Code, [2] Cursor, [3] Manual"
  4. Create ~/.polyagent/config.json
  5. For Claude Code: Update ~/.claude/mcp_config.json
  6. For Cursor: Show manual config instructions
  ↓
User: polyagent-mcp verify
  ↓
Verify: Test MCP connection, framework loading, config validity
  ↓
Output: "✓ All components healthy. PolyAgent ready."
```

**MCP Server Startup Flow:**

```
AI Tool starts polyagent-mcp (subprocess)
  ↓
server.ts: main()
  1. Load config from ~/.polyagent/config.json
  2. Initialize logger (stdout or file)
  3. Load framework YAML files (3 frameworks)
  4. Initialize MCP Server (SDK)
  5. Register tool handlers (empty for Epic 1)
  6. Listen on stdio
  7. Log: "PolyAgent MCP Server v{version} ready"
  ↓
AI Tool: Send MCP initialize
  ↓
Server: Respond with capabilities
  ↓
AI Tool: Send initialized
  ↓
Server: Ready for tool calls
  ↓
(Tools added in Epics 2-4)
```

---

## Non-Functional Requirements

### Performance

**Startup Time (NFR4):**
- Cold start: < 5 seconds (first run, load frameworks + validate config)
- Warm start: < 1 second (config cached, frameworks loaded)
- MCP connection establishment: < 500ms

**Memory Footprint (NFR3):**
- MCP server process: < 50MB for Epic 1 (no tools loaded yet)
- Framework YAML data: < 1MB (3 frameworks with 10-15 requirements each)
- Total: < 100MB (lightweight foundation)

**Measurement:** Use `process.memoryUsage()` in health check

### Security

**API Key Management (NFR5):**
- Config file at `~/.polyagent/config.json` with restricted permissions (chmod 600)
- API keys NEVER logged (even in debug mode)
- Support `OPENAI_API_KEY` env var (takes precedence over file)
- Validation: Setup wizard warns if config file has loose permissions

**Code Execution Safety (NFR6):**
- File path validation prevents directory traversal (`../` in paths rejected)
- Config JSON parsing sanitized (no `eval()` or unsafe operations)
- Framework YAML validated against schema (reject malformed YAML)

**Dependency Security (NFR7):**
- Run `npm audit` in CI/CD
- Pin major versions in package.json (allows patch updates)
- Minimal dependency tree (only MCP SDK, OPA WASM, logging lib, YAML parser)

### Reliability

**Error Recovery (NFR13):**
- Config load failure → Use defaults, log warning, continue (degraded mode)
- Framework YAML corruption → Skip corrupted framework, load others, log error
- MCP connection failure → Retry 3 times with exponential backoff (1s, 2s, 4s)

**Graceful Degradation:**
- Missing API key → Server starts, RAG disabled (tools added in Epic 3 will handle)
- Invalid config → Use defaults where possible, error only on critical missing fields

### Observability

**Logging (NFR14):**
- Format: `{timestamp} [{level}] {component}: {message}`
- Components: `mcp-server`, `config`, `framework-store`, `logger`, `health-check`
- Levels: ERROR (always), WARN (default), INFO (default), DEBUG (opt-in)
- File rotation: 1MB max per file, keep 5 files
- Sensitive data redacted: API keys, file paths containing home directory

**Health Monitoring (FR54):**
- Health check queries:
  - Server: Process running?
  - Config: Valid config loaded?
  - Frameworks: All 3 YAML files loaded?
  - OPA: WASM module available? (checked but not loaded until Epic 2)
  - RAG: API key configured? (checked but not initialized until Epic 3)
- Health output: Component-specific status (✓ healthy, ⚠ degraded, ✗ unavailable)

---

## Dependencies and Integrations

**Production Dependencies:**
```json
{
  "@modelcontextprotocol/sdk": "1.22.0",
  "@open-policy-agent/opa-wasm": "1.10.0",
  "js-yaml": "^4.1.0",
  "pino": "^9.0.0",
  "pino-pretty": "^11.0.0"
}
```

**Development Dependencies:**
```json
{
  "typescript": "5.9.3",
  "@types/node": "^22.0.0",
  "@types/js-yaml": "^4.0.9",
  "jest": "^29.7.0",
  "ts-jest": "^29.1.0",
  "@types/jest": "^29.5.0",
  "eslint": "^9.0.0",
  "@typescript-eslint/parser": "^8.0.0",
  "@typescript-eslint/eslint-plugin": "^8.0.0",
  "prettier": "^3.3.0"
}
```

**External Integrations:**
- **MCP Client (AI Tool):** Claude Code, Cursor, Continue.dev
  - Protocol: stdio transport, JSON-RPC 2.0
  - Connection: AI tool spawns `polyagent-mcp start` as subprocess
- **File System:** Read framework YAML from `node_modules/@polyagent/mcp-server/frameworks/`
  - Read config from `~/.polyagent/config.json`
  - Write logs to `~/.polyagent/logs/` (if configured)
- **OpenAI API:** Not used in Epic 1 (RAG in Epic 3)
- **Git:** Not used in Epic 1 (policy repos in Epic 3)

---

## Acceptance Criteria (Authoritative)

### AC-1: Project builds and tests run
- `npm run build` compiles TypeScript to dist/ without errors
- `npm test` executes Jest test suite
- `npm run lint` passes ESLint checks

### AC-2: MCP server accepts connections
- Server starts via `polyagent-mcp start`
- Responds to MCP `initialize` request with capabilities
- Responds to `tools/list` with empty array
- Connection established < 500ms

### AC-3: Configuration loads correctly
- Reads `~/.polyagent/config.json` on startup
- Validates JSON schema
- Overrides with env vars (`OPENAI_API_KEY`, `POLYAGENT_LOG_LEVEL`)
- Uses defaults if config missing

### AC-4: Logging works
- Structured logs to stdout/file
- Log levels filter correctly (info = INFO/WARN/ERROR, debug = all)
- API keys never logged
- Debug mode shows MCP protocol messages

### AC-5: Health check reports status
- `polyagent-mcp health` verifies all components
- Reports: Server, Config, Frameworks, OPA (check available), RAG (check configured)
- Exit code 0 if healthy, 1 if degraded/unavailable

### AC-6: Framework data loads
- 3 framework YAML files embedded in package
- YAML validated against schema on load
- FrameworkStore API: listFrameworks(), getRequirement(), listRequirements()
- Invalid YAML logged as error, doesn't crash server

### AC-7: npm package installs globally
- `npm install -g @polyagent/mcp-server` succeeds
- `which polyagent-mcp` shows bin in PATH
- `polyagent-mcp version` shows correct version

### AC-8: Setup wizard configures AI tools
- `polyagent-mcp setup` detects Claude Code/Cursor
- Prompts for OpenAI API key
- Creates `~/.polyagent/config.json`
- For Claude Code: Updates `~/.claude/mcp_config.json`

### AC-9: Verify command tests installation
- `polyagent-mcp verify` tests server start
- Tests MCP connection
- Tests framework loading
- Exit code 0 if all pass, 1 if any fail

---

## Traceability Mapping

| AC | Spec Section | Components | Test Approach |
|----|--------------|------------|---------------|
| AC-1 | Build System | package.json, tsconfig.json, jest.config.js | Unit: Build succeeds, tests run |
| AC-2 | MCP Server Core | src/server.ts, MCP SDK | Integration: Mock MCP client connection |
| AC-3 | Configuration System | src/lib/config-manager.ts | Unit: Load valid/invalid configs, env overrides |
| AC-4 | Logging | src/lib/logger.ts | Unit: Log levels, file rotation, redaction |
| AC-5 | Health Check | src/lib/health-check.ts, CLI | Integration: Query health endpoint |
| AC-6 | Framework Store | src/lib/framework-store.ts, frameworks/*.yaml | Unit: Load YAML, query requirements, validation |
| AC-7 | npm Package | package.json, bin/polyagent-mcp | Manual: Install globally, verify PATH |
| AC-8 | Setup Wizard | bin/polyagent-mcp (setup command) | Manual: Run wizard, check config created |
| AC-9 | Verify Command | bin/polyagent-mcp (verify command) | Integration: Run verify, check exit codes |

**FR Traceability (Epic 1 covers 23 FRs):**

| Story | FRs Covered | PRD Reference |
|-------|-------------|---------------|
| 1.1 | Build system foundation | Enables all FRs |
| 1.2 | FR1-6 | PRD lines 298-303 (MCP Server Core) |
| 1.3 | FR43-49 | PRD lines 355-361 (User Configuration) |
| 1.4 | FR6, FR52-54 | PRD lines 303, 365-369 (Logging, Health) |
| 1.5 | FR36-38 | PRD lines 345-348 (Framework Data) |
| 1.6 | FR56-60 | PRD lines 374-378 (Installation & Setup) |

---

## Risks, Assumptions, Open Questions

**Assumptions:**
- ✅ Node.js v24 LTS or v22 LTS installed on user's machine
- ✅ User has npm (comes with Node.js)
- ✅ User has write access to `~/.polyagent/` directory
- ✅ Claude Code or Cursor installed (for MCP client)
- ⚠️ OpenAI API key available (optional for Epic 1, required for Epic 3 RAG)

**Risks:**
- 🟡 **MCP SDK API stability** - v1.22.0 is recent, may have breaking changes
  - Mitigation: Pin exact version, document upgrade path
- 🟡 **Config file corruption** - User manually edits JSON incorrectly
  - Mitigation: Schema validation, `validate-config` command, clear error messages
- 🟢 **Framework YAML becomes stale** - Security frameworks evolve
  - Mitigation: Version framework data separately, community PRs for updates

**Open Questions:**
- ❓ Should setup wizard support both Claude Code AND Cursor in single run, or choose one?
  - Decision: Choose one, user can re-run setup for second tool
- ❓ Log file location for multiple MCP server instances (different AI tools running simultaneously)?
  - Decision: Single log file for MVP (low risk of collision), per-PID logs in future
- ❓ Should framework YAML support includes/references (DRY for repeated controls)?
  - Decision: No for MVP (keep YAML simple), consider in Phase 2 if duplication becomes issue

---

## Test Strategy Summary

### Unit Tests (Target: >70% coverage per NFR15)

**Files to Test:**
- `src/lib/config-manager.ts`:
  - Load valid config
  - Load invalid config (malformed JSON, missing fields)
  - Env var overrides
  - Default values
  - Schema validation
- `src/lib/logger.ts`:
  - Log level filtering
  - File rotation (mock fs)
  - Sensitive data redaction
  - Component tagging
- `src/lib/framework-store.ts`:
  - Load valid YAML
  - Load invalid YAML (schema violations)
  - Query existing requirement
  - Query non-existent requirement
  - List frameworks
  - List requirements
- `src/lib/health-check.ts`:
  - All components healthy
  - Some components degraded
  - Component unavailable

**Test Framework:** Jest with ts-jest

### Integration Tests

**MCP Connection Test:**
- Mock MCP client sends `initialize`
- Verify server responds with capabilities
- Send `tools/list`
- Verify empty array returned (tools added in later epics)

**CLI Command Tests:**
- `polyagent-mcp version` → verify output format
- `polyagent-mcp health` → verify health status format
- `polyagent-mcp validate-config` → test with valid/invalid configs

### Manual Testing Checklist (Story 1.6)

- [ ] Install globally: `npm install -g @polyagent/mcp-server`
- [ ] Verify bin in PATH: `which polyagent-mcp`
- [ ] Run setup wizard: `polyagent-mcp setup`
- [ ] Check config created: `cat ~/.polyagent/config.json`
- [ ] Run verify: `polyagent-mcp verify`
- [ ] Connect Claude Code to server
- [ ] Run health check: `polyagent-mcp health`

### Edge Cases to Test

- Config file missing → uses defaults
- Config file malformed → clear error message
- Framework YAML corrupted → logs error, skips framework, doesn't crash
- Multiple MCP clients connecting simultaneously → each gets own connection
- Server shutdown during MCP call → graceful termination

---

**Epic 1 Tech Spec Complete.**

This spec provides detailed implementation guidance for all 6 stories in Epic 1. Use this document alongside architecture.md and epics.md when implementing stories.

**Next:** Run `*create-story` for Story 1.1 to generate developer-ready story file.
