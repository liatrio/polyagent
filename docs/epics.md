# PolyAgent - Epic & Story Breakdown

**Project:** polyagent
**Author:** John (PM Agent) + ianhundere
**Date:** 2025-11-19
**Version:** 1.0
**Based On:** PRD v1.0 + Architecture v1.0

---

## Epic Structure Overview

This epic breakdown transforms the 60 functional requirements from the PRD into implementable stories for the 2-week MVP sprint. Epics are organized by user value delivered, not technical layers.

**Context Incorporated:**
- ✅ PRD (60 FRs + NFRs)
- ✅ Architecture (MCP server design, RAG pipeline, OPA integration, ADRs)
- ⏭️ UX Design (N/A - no UI for MCP server)

---

## FR Coverage Map

### Epic 1: Foundation & MCP Server Core
**Covers:** FR1-6, FR36-42, FR43-49, FR56-60 (Infrastructure, Config, Installation)
**Value:** Establishes working MCP server that AI tools can connect to

### Epic 2: Interactive Policy Debugging
**Covers:** FR7-15 (explain_policy_decision tool)
**Value:** Developers can conversationally debug OPA policies through AI assistants

### Epic 3: Policy Example Search
**Covers:** FR16-25 (search_policy_examples tool with RAG)
**Value:** Developers can find proven policy patterns via semantic search

### Epic 4: Framework Requirements Lookup
**Covers:** FR26-35 (fetch_framework_requirement tool)
**Value:** Developers can query security framework requirements without context switching

### Epic 5: Error Handling & Diagnostics
**Covers:** FR50-55 (Error handling, health checks, debugging)
**Value:** Reliable tool with clear error messages and troubleshooting support

---

## Epic 1: Foundation & MCP Server Core

**Epic Goal:** Establish working MCP server infrastructure that AI tools (Claude Code, Cursor) can connect to, with configuration management, logging, and health monitoring.

**User Value:** Developers can install PolyAgent and have their AI coding assistant successfully connect to the MCP server, with clear feedback on connection status and configuration.

**FRs Covered:** FR1-6 (MCP core), FR36-42 (data management), FR43-49 (configuration), FR56-60 (installation)

**Total Stories:** 6

---

### Story 1.1: Project Setup & Build System

**As a** developer building PolyAgent,
**I want** a properly initialized TypeScript/Node.js project with MCP SDK integration,
**So that** I can start implementing MCP tools with proper type safety and build configuration.

**Acceptance Criteria:**

**Given** I'm starting the PolyAgent project
**When** I initialize the project structure
**Then** the following must exist and work correctly:

- TypeScript project initialized with strict mode enabled
- `package.json` with dependencies:
  - `@modelcontextprotocol/sdk@1.22.0` (MCP SDK, verified 2025-11-19)
  - `@open-policy-agent/opa-wasm@1.10.0` (OPA WebAssembly, verified 2025-11-19)
  - `typescript@5.9.3` (latest stable, verified 2025-11-19)
  - Development dependencies: `@types/node`, `jest@29.x`, `ts-jest`, `eslint@9.x`, `prettier@3.x`
- `tsconfig.json` with strict type checking, ES2022 target, Node.js moduleResolution
- Node.js v24.11.0 LTS or v22.11.0 LTS required (verified 2025-11-19)
- Build system: `npm run build` compiles TypeScript to `dist/`
- Test system: `npm test` runs Jest with TypeScript support
- Linting: `npm run lint` runs ESLint with TypeScript parser
- Git initialized with `.gitignore` (node_modules, dist, .env)

**And** project structure follows architecture spec (line 447-460 in architecture.md):
```
src/
  server.ts         # MCP server entry point
  tools/            # MCP tool implementations
  lib/              # Shared libraries
  types/            # TypeScript type definitions
__tests__/
  unit/
  integration/
```

**And** `npm run build` succeeds without errors
**And** `npm test` runs (even with no tests yet)

**Prerequisites:** None (foundational story)

**Technical Notes:**
- Follow ADR-005 (TypeScript over Go/Python)
- Use npm (not pnpm/yarn) for broader compatibility
- Strict TypeScript configuration prevents runtime errors
- Architecture reference: lines 447-460

---

### Story 1.2: MCP Server Core Implementation

**As a** developer using an AI coding assistant,
**I want** a working MCP server that can accept connections,
**So that** my AI tool can communicate with PolyAgent via the Model Context Protocol.

**Acceptance Criteria:**

**Given** the project is set up (Story 1.1 complete)
**When** I start the MCP server
**Then** the following must work:

- Server listens on stdio for MCP JSON-RPC messages (per architecture line 38)
- Server responds to MCP `initialize` request with capabilities list
- Server responds to MCP `tools/list` request with empty array (tools added in later stories)
- Server handles connection lifecycle (connect → ready → shutdown)
- Server logs startup message: "PolyAgent MCP Server v{version} ready"

**And** when AI tool connects:
- Connection established within < 500ms (NFR4)
- Server returns valid MCP protocol handshake
- No errors logged on successful connection

**And** error handling works:
- Invalid JSON-RPC → structured error response (NFR50)
- Unknown MCP method → error with available methods
- Server doesn't crash on malformed requests (NFR13)

**Prerequisites:** Story 1.1 (project setup)

**Technical Notes:**
- Use `@modelcontextprotocol/sdk` Server class
- Implement stdio transport (standard for MCP)
- Follow MCP protocol spec for message format
- ADR-004: MCP Protocol over CLI/REST API
- Architecture reference: lines 41-49, 157-177 (ADR-004)

---

### Story 1.3: Configuration System

**As a** developer setting up PolyAgent,
**I want** a configuration file for API keys and settings,
**So that** I can customize PolyAgent for my environment without modifying code.

**Acceptance Criteria:**

**Given** PolyAgent is installed
**When** I create `~/.polyagent/config.json`
**Then** the system must:

- Load configuration from `~/.polyagent/config.json` on startup (per architecture lines 346-377)
- Support JSON schema validation against config schema
- Provide clear error messages for invalid config (NFR51)
- Support these configuration sections:
  - `embedding`: { provider, apiKey, model }
  - `policyExamples`: { repos, updateInterval }
  - `opa`: { engine, binaryPath }
  - `logging`: { level, file }

**And** environment variable overrides work:
- `OPENAI_API_KEY` env var overrides `embedding.apiKey`
- `POLYAGENT_LOG_LEVEL` env var overrides `logging.level`
- Env vars take precedence over config file

**And** configuration validation (FR49):
- `polyagent-mcp validate-config` command checks config
- Reports missing required fields (embedding.apiKey if RAG enabled)
- Reports invalid values (unknown log level, malformed repo URL)
- Returns exit code 0 if valid, 1 if invalid

**And** defaults work without config file:
- Logging defaults to "info" level, stdout
- OPA defaults to "wasm" engine
- Policy examples defaults to disabled if no API key

**Prerequisites:** Story 1.2 (MCP server core)

**Technical Notes:**
- Configuration schema from architecture lines 346-377
- Support JSON with comments (strip before parsing)
- NFR5: API keys never logged
- Create `~/.polyagent/` directory if doesn't exist
- Cross-platform path handling (Windows vs Unix)

---

### Story 1.4: Logging & Health Monitoring

**As a** developer troubleshooting PolyAgent issues,
**I want** structured logging and health check capabilities,
**So that** I can diagnose problems and verify the system is working correctly.

**Acceptance Criteria:**

**Given** PolyAgent MCP server is running
**When** operations occur
**Then** structured logs must be written:

- Log format: `{timestamp} [{level}] {component}: {message}` (NFR14)
- Log levels: ERROR, WARN, INFO, DEBUG
- Components tagged: `mcp-server`, `tool:explain_policy`, `tool:search_examples`, `tool:fetch_framework`, `opa-engine`, `rag-engine`, `config`
- Sensitive data never logged: API keys, policy content (unless debug mode), traces (unless requested)

**And** log output respects configuration:
- If `logging.file` specified → write to file with rotation (1MB max per file, keep 5 files)
- If no file specified → write to stdout
- Log level filters messages (`info` shows INFO/WARN/ERROR, `debug` shows all)

**And** health check endpoint works (FR54):
- `polyagent-mcp health` command queries server
- Returns: Server status, OPA engine status, RAG system status, config validity
- Exit code 0 if healthy, 1 if any component unhealthy
- Output shows component-specific health:
  ```
  ✓ MCP Server: Running
  ✓ OPA WASM: Loaded
  ⚠ RAG System: No API key configured (degraded mode)
  ✓ Configuration: Valid
  ```

**And** debug mode provides detailed diagnostics (FR53):
- Enable via `POLYAGENT_DEBUG=true` env var
- Shows MCP protocol messages (JSON-RPC requests/responses)
- Shows tool invocation details (inputs, outputs, execution time)
- Shows RAG search internals (query embedding, similarity scores)

**Prerequisites:** Story 1.3 (configuration system)

**Technical Notes:**
- Use structured logging library (pino or winston)
- NFR14: Log rotation prevents unbounded disk usage
- Health check via IPC or special MCP tool
- Debug logs help diagnose MCP connection issues

---

### Story 1.5: Framework Data Embedding

**As a** developer using PolyAgent,
**I want** security framework requirements embedded in the package,
**So that** framework lookups work offline without external dependencies.

**Acceptance Criteria:**

**Given** PolyAgent is installed
**When** I query framework requirements
**Then** embedded YAML data must be available:

- `frameworks/openssf-slsa.yaml` with SLSA Levels 1-4 (FR32)
- `frameworks/cis-kubernetes.yaml` with CIS Kubernetes Benchmarks (FR33)
- `frameworks/nist-800-190.yaml` with container security guidance (FR34)

**And** YAML schema is validated (FR38):
- Each framework YAML contains: `framework` object with (id, name, version, url)
- Each framework has `requirements` array with objects: (id, title, description, rationale, controls, references)
- Schema validation runs on load, reports validation errors with line numbers
- Invalid YAML prevents server startup with clear error message

**And** custom framework YAML can override embedded data (FR37):
- If `~/.polyagent/frameworks/openssf-slsa.yaml` exists, it overrides embedded version
- Custom frameworks can be added in user config directory
- Validation applies to custom frameworks same as embedded

**And** framework data is accessible via internal API:
- `FrameworkStore.listFrameworks()` returns all framework IDs
- `FrameworkStore.getRequirement(frameworkId, requirementId)` returns requirement object
- Handles invalid IDs gracefully with suggestions

**Prerequisites:** Story 1.3 (configuration system)

**Technical Notes:**
- Framework YAML schema documented in architecture lines 379-410
- ADR-003: Embed framework data vs fetch from APIs
- Use `js-yaml` library for parsing
- Validate YAML against JSON Schema
- Framework data versioned separately (noted in package.json)

---

### Story 1.6: npm Package Distribution & Installation

**As a** developer wanting to use PolyAgent,
**I want** to install it via npm and configure it for my AI tool,
**So that** I can start using PolyAgent in my policy development workflow.

**Acceptance Criteria:**

**Given** PolyAgent is published to npm
**When** I run `npm install -g @polyagent/mcp-server`
**Then** installation must succeed:

- Package installs globally with bin command: `polyagent-mcp`
- Executable available in PATH: `which polyagent-mcp` works
- Version command works: `polyagent-mcp version` shows current version
- Help command works: `polyagent-mcp help` shows available commands

**And** setup wizard guides configuration (FR57):
- `polyagent-mcp setup` starts interactive wizard
- Detects installed AI tools (checks for `~/.claude`, `~/.cursor`) (FR58)
- Prompts for OpenAI API key (for RAG embedding)
- Offers to configure Claude Code or Cursor automatically
- Creates `~/.polyagent/config.json` with user inputs
- For Claude Code: Adds MCP server config to `~/.claude/mcp_config.json`
- For Cursor: Shows manual config instructions (Cursor MCP config varies)

**And** installation verification works (FR59):
- `polyagent-mcp verify` command tests all 3 MCP tools
- Runs simple test for each tool:
  - `explain_policy_decision`: Evaluates test policy with test input
  - `search_policy_examples`: Searches for "rbac" (requires API key)
  - `fetch_framework_requirement`: Fetches SLSA Level 1
- Reports success/failure for each tool
- Exit code 0 if all tools work, 1 if any fail

**And** package includes documentation (FR5 from PRD scope):
- README.md with quick start (5-minute setup)
- examples/ directory with 3-5 usage scenarios
- CONTRIBUTING.md with guidelines

**Prerequisites:** Stories 1.1-1.5 (all foundation components)

**Technical Notes:**
- Package name: `@polyagent/mcp-server` (scoped package, architecture line 185)
- npm package structure per architecture lines 447-460
- CLI entry point: `bin/polyagent-mcp` → `dist/server.js`
- Semver versioning per architecture line 190-192
- Distribution via npm, not GitHub releases (standard Node.js)

---

## Epic 2: Interactive Policy Debugging

**Epic Goal:** Enable conversational OPA policy debugging through AI assistants by providing MCP tool that executes policies, captures evaluation traces, and returns structured data for AI explanation.

**User Value:** Developers can ask their AI assistant "Why did this policy deny?" and get plain-English explanations based on actual OPA evaluation traces, eliminating manual CLI debugging.

**FRs Covered:** FR7-15 (explain_policy_decision tool)

**Total Stories:** 4

---

### Story 2.1: OPA WASM Engine Integration

**As a** developer debugging an OPA policy,
**I want** PolyAgent to evaluate Rego policies using OPA engine,
**So that** evaluation results match what OPA CLI would produce.

**Acceptance Criteria:**

**Given** I have a Rego policy file
**When** I trigger policy evaluation via the tool
**Then** OPA WASM engine must:

- Load and compile `.rego` file to WASM module
- Support both Rego v0 and v1 syntax (FR15)
- Execute policy evaluation with provided input data (JSON)
- Return evaluation result (boolean, object, or set)
- Complete evaluation in < 2 seconds for policies < 500 lines (NFR1)

**And** integration uses `@open-policy-agent/opa-wasm` per ADR-001 (architecture lines 157-177):
- WASM module loaded from npm package
- No external OPA binary required
- Works cross-platform (macOS, Linux, Windows per NFR12)

**And** policy syntax errors are handled (FR14):
- Parse errors return line number and error description
- Compilation errors return clear error message
- Invalid package/rule names return suggestions

**And** memory footprint is managed:
- WASM runtime uses < 50MB RAM (architecture line 531)
- Multiple evaluations reuse WASM instance
- Cleanup after evaluation prevents memory leaks

**Prerequisites:** Story 1.2 (MCP server core)

**Technical Notes:**
- Use `@open-policy-agent/opa-wasm` npm package
- Load policy from disk via Node.js `fs` module
- Validate file paths to prevent directory traversal (NFR6)
- ADR-001 rationale: WASM over binary for zero external dependencies
- Architecture reference: lines 157-177, 346 (OPA integration)

---

### Story 2.2: Evaluation Trace Capture

**As a** developer debugging policy logic,
**I want** PolyAgent to capture which rules evaluated and their results,
**So that** I can understand the evaluation flow and why a decision was made.

**Acceptance Criteria:**

**Given** OPA WASM engine is integrated (Story 2.1)
**When** a policy is evaluated with input data
**Then** evaluation trace must capture:

- List of all rules evaluated during execution (FR11)
- For each rule: name, line number, evaluation result (true/false/undefined) (FR12, FR13)
- Variables referenced in each rule with their values (FR13)
- Final decision result
- Execution path (which rules were skipped, which fired)

**And** trace data is structured for AI consumption:
```typescript
interface EvaluationTrace {
  line: number;
  rule: string;
  evaluated: boolean;
  result: boolean | null;
  variables?: Record<string, any>;
}
```
(Per architecture lines 121-132)

**And** trace includes context for explanation:
- Rule name mapped to source line in Rego file
- Variable values at time of rule evaluation
- Partial evaluation results for compound rules

**And** trace generation doesn't significantly impact performance:
- Trace overhead < 20% of evaluation time
- Trace data size < 1MB for typical policies

**Prerequisites:** Story 2.1 (OPA WASM integration)

**Technical Notes:**
- Use OPA SDK trace API if available
- May require eval with `trace: true` flag
- Architecture reference: lines 121-132 (trace schema)
- FR11-13: Trace requirements from PRD

---

### Story 2.3: MCP Tool - explain_policy_decision

**As a** developer using an AI coding assistant,
**I want** to invoke policy evaluation through MCP tool,
**So that** I can debug policies conversationally without leaving my editor.

**Acceptance Criteria:**

**Given** MCP server is running with OPA engine (Stories 1.2, 2.1, 2.2)
**When** AI assistant calls `explain_policy_decision` MCP tool
**Then** tool must be registered and callable:

- Tool name: `explain_policy_decision`
- Tool accepts input schema (per architecture lines 115-120):
  ```typescript
  {
    policyPath: string;
    inputData: object;
    packageName?: string;
    ruleName?: string;
  }
  ```

**And** tool execution flow works:
1. Receive MCP tool request with policy path + input data
2. Load Rego file from `policyPath` (FR7)
3. Parse input data JSON (FR8)
4. If `packageName` and `ruleName` provided, target specific rule; else auto-detect (FR9)
5. Execute evaluation via OPA WASM (FR10)
6. Capture evaluation trace (FR11)
7. Return structured output (per architecture lines 121-132)

**And** output schema matches architecture spec:
```typescript
{
  result: boolean | object;
  trace: EvaluationTrace[];
  error?: string;
}
```

**And** error handling provides actionable feedback (NFR51):
- File not found → "Policy file not found at {path}. Check file path."
- Invalid JSON → "Input data is not valid JSON: {error}"
- Syntax error → "Policy syntax error at line {N}: {description}"
- Evaluation failure → "Evaluation failed: {reason}"

**And** tool is logged and monitored (FR6):
- Log: "Tool invoked: explain_policy_decision with policy={path}"
- Log execution time for performance monitoring
- Log errors with full context (tool, inputs, stack trace per FR52)

**Prerequisites:** Stories 2.1, 2.2 (OPA engine + trace capture)

**Technical Notes:**
- MCP tool registration in server.ts
- Input schema from architecture lines 115-120
- Output schema from architecture lines 121-132
- Implementation approach from architecture lines 133-155
- NFR1: < 2s response time for typical policies

---

### Story 2.4: Example Test Policies & Documentation

**As a** developer trying PolyAgent for the first time,
**I want** example policies and usage scenarios for the debugging tool,
**So that** I can quickly verify it works and understand how to use it.

**Acceptance Criteria:**

**Given** PolyAgent is installed
**When** I read the documentation
**Then** examples must be provided:

- `examples/debug-why-deny.md` - Tutorial: "Why did my policy deny this request?"
  - Includes sample `.rego` file with RBAC policy
  - Includes sample input JSON that gets denied
  - Shows how to ask AI: "Why did this deny?"
  - Shows expected AI response explaining which rule fired

- `examples/policies/rbac-simple.rego` - Test policy for verification
  - Simple allow/deny logic
  - Well-commented for learning
  - Used by `polyagent-mcp verify` command (Story 1.6)

**And** README.md documents the tool (FR5 from PRD scope):
- Tool name and purpose
- Input parameters with examples
- Output format with sample trace
- Common use cases:
  - "Why did this deny?"
  - "Which rule triggered?"
  - "What would allow this request?"

**And** verification test uses example policy (from Story 1.6):
- `polyagent-mcp verify` evaluates `examples/policies/rbac-simple.rego`
- Confirms trace is captured correctly
- Provides confidence that tool works

**Prerequisites:** Story 2.3 (explain_policy_decision tool complete)

**Technical Notes:**
- Examples from architecture don't specify test policies, create simple ones
- README MCP tool reference section (architecture line 213)
- Keep examples simple (< 50 lines Rego) for quick validation

---

## Epic 3: Policy Example Search (RAG)

**Epic Goal:** Enable semantic search over curated policy example repositories using RAG, allowing developers to find proven implementation patterns through natural language queries.

**User Value:** Developers can ask "Show me examples of Sigstore signature verification" and instantly get relevant working policies from community repositories, eliminating manual GitHub searching.

**FRs Covered:** FR16-25 (search_policy_examples tool with RAG)

**Total Stories:** 5

---

### Story 3.1: Policy Repository Downloader & Indexer

**As a** system preparing for RAG search,
**I want** to download and index curated policy example repositories,
**So that** policy code is available locally for embedding generation.

**Acceptance Criteria:**

**Given** PolyAgent setup is running
**When** I configure policy example repositories
**Then** system must download and index:

- 5 curated repos per architecture (lines 230-234):
  1. `liatrio/demo-gh-autogov-policy-library`
  2. `open-policy-agent/gatekeeper-library`
  3. `sigstore/policy-controller` (path: `examples/policies`)
  4. `scalr/policy-library`
  5. `redhat-cop/rego-policies`

**And** repository caching works (FR41):
- Repos cloned to `~/.polyagent/policy-examples/repos/`
- Only clone on first setup (not every startup)
- Skip if already cached locally

**And** indexing creates policy metadata (FR39):
- Scan each repo for `.rego` files
- Extract for each policy:
  - File path
  - Package name (from `package` directive)
  - Comments (first 10 lines for description)
  - Tags (extracted from comments or path, e.g., "sigstore", "kubernetes", "rbac")
- Store in `~/.polyagent/policy-examples/index.json`

**And** repository updates are supported (FR42):
- `updateInterval` from config (default: 7 days)
- On startup, check last update timestamp
- If interval elapsed, git pull latest changes
- Re-index only changed files (not full re-embed)

**And** custom repositories can be added (FR40, FR45):
- Config: `policyExamples.repos` array accepts custom repos
- Supports GitHub URLs and local file paths
- Local paths: scan directory for `.rego` files, no git operations

**Prerequisites:** Story 1.3 (configuration system)

**Technical Notes:**
- Use `simple-git` library for git clone/pull operations
- Index schema per architecture lines 412-426
- Cache location: `~/.polyagent/policy-examples/`
- Incremental updates save time vs full re-clone

---

### Story 3.2: Embedding Generation Pipeline

**As a** system preparing RAG search capability,
**I want** to generate vector embeddings for all policy examples,
**So that** semantic search can find relevant policies by meaning, not just keywords.

**Acceptance Criteria:**

**Given** policy repositories are indexed (Story 3.1)
**When** embedding generation runs (during setup or update)
**Then** embeddings must be created:

- For each policy in index, generate embedding via OpenAI API
- Use model `text-embedding-3-small` (per architecture line 350)
- Embedding input: Full Rego file content + metadata (package, description, tags)
- Store embedding vector (1536 dimensions for text-embedding-3-small)

**And** embedding generation is batched for API efficiency:
- Batch size: 100 policies per API request (if API supports batching)
- Rate limiting: Respect OpenAI rate limits (pause if hit 429 error)
- Progress indicator: Show "Embedding policy X of Y..." during setup
- Estimated setup time: ~2-3 minutes for 500-1000 policies

**And** embeddings are persisted (architecture lines 253-257):
- Save to `~/.polyagent/policy-examples/embeddings.bin` (binary format)
- Also save to `index.json` for quick access
- Embedding cache tagged with:
  - OpenAI model used
  - Generation timestamp
  - PolyAgent version

**And** incremental embedding works:
- Only generate embeddings for new/changed policies
- Reuse cached embeddings for unchanged policies
- Hash policy content to detect changes

**And** embedding API errors are handled:
- Missing API key → clear error with setup instructions (FR43)
- API failure → retry with exponential backoff (NFR13)
- Invalid API key → actionable error message
- Rate limit → pause and retry after timeout

**Prerequisites:** Story 3.1 (policy repository indexer)

**Technical Notes:**
- Use OpenAI Node.js SDK for embeddings API
- Architecture reference: lines 349-353 (RAG system / embedding model)
- Embedding cost estimate: ~$0.10 for 1000 policies (inform user)
- ADR-002: In-memory vector store (embeddings loaded at runtime)

**Future Enhancement (Phase 2):**
- Consider `repomix` (https://github.com/yamadashy/repomix) for packaging policy repos
- Alternative to git clone: Pack repo into single AI-friendly XML/Markdown file
- Benefits: Portable context, token counting, faster for small policy sets
- See architecture.md "Enhancement: Repomix for Portable Policy Context" (lines 717-748)

---

### Story 3.3: In-Memory Vector Search Engine

**As a** developer querying for policy examples,
**I want** fast semantic search over embedded policies,
**So that** search results return in < 1 second without external database dependencies.

**Acceptance Criteria:**

**Given** embeddings are generated (Story 3.2)
**When** MCP server starts
**Then** vector search engine must initialize:

- Load embeddings from `~/.polyagent/policy-examples/embeddings.bin`
- Build in-memory index (simple array, no complex indexing needed)
- Loading completes in < 1 second (warm start, NFR4)
- Memory footprint < 500MB for ~1000 policies (NFR3)

**And** semantic search works (FR18):
- Accept natural language query (e.g., "Sigstore signature verification")
- Generate query embedding via OpenAI API
- Compute cosine similarity between query embedding and all policy embeddings
- Return top-N results sorted by similarity score (descending)

**And** search performance meets targets (NFR1):
- Search completes in < 1 second including embedding API call
- Cosine similarity computation < 50ms for 1000 policies
- Result ranking and filtering < 10ms

**And** search quality meets standards (NFR2):
- For well-formed queries, top-3 results are relevant (70%+ relevance target)
- Similarity scores included in results (0.0-1.0 range)
- Low-scoring results (< 0.5 similarity) trigger "no relevant results" message (FR25)

**And** filtering is supported (FR22):
- Optional `filterRepo` parameter filters to specific repository
- Example: `filterRepo: "gatekeeper"` only searches Gatekeeper policies
- Filtering applied before similarity ranking

**Prerequisites:** Story 3.2 (embedding generation)

**Technical Notes:**
- ADR-002: In-memory vector store over external vector DB
- Cosine similarity formula: `dot(a, b) / (norm(a) * norm(b))`
- Use typed arrays for performance (`Float32Array`)
- Architecture reference: lines 187-201 (ADR-002), lines 349-353 (vector search)
- No external database needed (keeps deployment simple)

---

### Story 3.4: MCP Tool - search_policy_examples

**As a** developer using an AI coding assistant,
**I want** to search for policy examples conversationally,
**So that** I can find proven implementation patterns without leaving my editor.

**Acceptance Criteria:**

**Given** RAG system is ready (Stories 3.1, 3.2, 3.3)
**When** AI assistant calls `search_policy_examples` MCP tool
**Then** tool must be registered and callable:

- Tool name: `search_policy_examples`
- Tool accepts input schema (per architecture lines 204-208):
  ```typescript
  {
    query: string;
    limit?: number;        // Default 3, max 10
    filterRepo?: string;
  }
  ```

**And** tool execution flow works:
1. Receive MCP tool request with query string (FR16)
2. Generate query embedding via OpenAI API
3. Search vector store (cosine similarity)
4. Rank results by similarity score
5. Apply `limit` (default 3, max 10 per FR17)
6. Apply `filterRepo` if specified (FR22)
7. Return top-N results (FR19)

**And** output schema matches architecture spec (lines 210-218):
```typescript
{
  results: PolicyExample[];
  totalFound: number;
}

interface PolicyExample {
  repo: string;
  path: string;
  snippet: string;          // Code excerpt, 200 lines max
  description: string;
  tags: string[];
  similarityScore: number;
}
```

**And** result formatting includes useful context (FR20, FR21):
- `repo`: Source repository name (e.g., "kubernetes/gatekeeper")
- `path`: Relative file path in repo
- `snippet`: Full policy code (up to 200 lines, truncate if larger)
- `description`: Extracted from comments or auto-generated summary
- `tags`: Metadata tags (e.g., ["sigstore", "admission", "kubernetes"])
- `similarityScore`: 0.0-1.0 (helps AI assess relevance)

**And** no-results handling works (FR25):
- If no results above 0.5 similarity threshold
- Return empty results array with `totalFound: 0`
- Include suggested alternative queries in response
- Example: Query "foo" → Suggest "Try: policy patterns, rego examples, opa policies"

**Prerequisites:** Story 3.3 (vector search engine)

**Technical Notes:**
- MCP tool registration in server.ts
- Architecture reference: lines 202-257 (RAG system)
- Snippet truncation: Keep first 200 lines if policy > 200 lines
- FR18-25: RAG search requirements from PRD

---

### Story 3.5: RAG Example Documentation & Verification

**As a** developer exploring PolyAgent's RAG capabilities,
**I want** examples showing how to search for policy patterns,
**So that** I understand how to phrase queries for best results.

**Acceptance Criteria:**

**Given** PolyAgent is installed with RAG configured
**When** I read the documentation
**Then** examples must be provided:

- `examples/search-sigstore-examples.md` - Tutorial: "Find Sigstore verification examples"
  - Shows query: "Sigstore signature verification for container images"
  - Shows sample results (repo, snippet, description)
  - Explains how to use results (copy pattern, adapt to needs)

- `examples/search-rbac-examples.md` - Tutorial: "Find RBAC policy patterns"
  - Shows query: "RBAC role-based access control for API endpoints"
  - Shows how to filter by repo: `filterRepo: "gatekeeper"`

- `examples/search-slsa-examples.md` - Tutorial: "Find SLSA provenance patterns"
  - Shows query: "SLSA provenance attestation verification"
  - Links to autogov repo examples

**And** README.md documents search_policy_examples tool:
- Tool purpose and use cases
- Input parameters (query, limit, filterRepo)
- Output format with sample results
- Tips for effective queries:
  - Be specific: "Sigstore signature verification" not "signatures"
  - Include domain: "Kubernetes admission control" not "admission"
  - Mention frameworks: "SLSA Level 3 provenance" not "provenance"

**And** verification test includes RAG search (from Story 1.6):
- `polyagent-mcp verify` searches for "rbac"
- Confirms results are returned (requires OpenAI API key)
- If no API key, skips RAG test with warning

**Prerequisites:** Story 3.4 (search_policy_examples tool complete)

**Technical Notes:**
- README section: "MCP Tool Reference - search_policy_examples"
- Query phrasing tips help users get better results
- Verification test validates end-to-end RAG pipeline

---

## Epic 4: Framework Requirements Lookup

**Epic Goal:** Provide instant access to security framework requirements (OpenSSF SLSA, CIS, NIST) through MCP tool, enabling developers to query framework text without context switching.

**User Value:** Developers can ask "What does SLSA Level 3 require?" and get official requirement text with references, eliminating manual documentation searches.

**FRs Covered:** FR26-35 (fetch_framework_requirement tool)

**Total Stories:** 3

---

### Story 4.1: Framework YAML Data Creation

**As a** system providing framework requirements,
**I want** structured YAML data for security frameworks,
**So that** requirement lookups return accurate, well-formatted information.

**Acceptance Criteria:**

**Given** I'm creating framework data files
**When** I populate YAML files for each framework
**Then** the following must be created:

**`frameworks/openssf-slsa.yaml`** (FR32):
- Framework metadata: id, name, version, url
- SLSA Level 1 requirements (basic provenance)
- SLSA Level 2 requirements (build service)
- SLSA Level 3 requirements (hardened build, signed provenance)
- SLSA Level 4 requirements (two-party review)
- Each requirement includes: id, title, description, rationale, controls, references

**`frameworks/cis-kubernetes.yaml`** (FR33):
- CIS Kubernetes Benchmarks (major security controls)
- Organized by section: Control Plane, Worker Nodes, Policies
- Key controls: Pod Security Standards, RBAC, Network Policies, Secrets Management
- Each control: id, title, description, rationale, references to official CIS docs

**`frameworks/nist-800-190.yaml`** (FR34):
- NIST 800-190 Application Container Security Guide
- Main sections: Image security, Registry security, Orchestrator security, Container security, Host security
- Key requirements for each section
- References to NIST official publication

**And** YAML schema is consistent (per architecture lines 379-410):
```yaml
framework:
  id: string
  name: string
  version: string
  url: string
requirements:
  - id: string
    title: string
    description: string
    rationale: string
    controls: string[]
    references: string[]
```

**And** content is accurate and up-to-date:
- SLSA from https://slsa.dev/spec/v1.0
- CIS Kubernetes from CIS Benchmarks v1.8+ (latest stable)
- NIST 800-190 from official NIST publication
- Include publication dates in framework metadata

**Prerequisites:** Story 1.5 (framework data embedding established)

**Technical Notes:**
- Framework data embedded in npm package per ADR-003
- Schema documented in architecture lines 379-410
- Start with essential requirements (can expand in future versions)
- Aim for 10-15 requirements per framework for MVP (comprehensive coverage comes later)

---

### Story 4.2: MCP Tool - fetch_framework_requirement

**As a** developer using an AI coding assistant,
**I want** to query security framework requirements through MCP,
**So that** I can get requirement text without leaving my editor or switching to documentation websites.

**Acceptance Criteria:**

**Given** framework YAML data exists (Story 4.1)
**When** AI assistant calls `fetch_framework_requirement` MCP tool
**Then** tool must be registered and callable:

- Tool name: `fetch_framework_requirement`
- Tool accepts input schema (per architecture lines 265-268):
  ```typescript
  {
    frameworkId: string;      // e.g., "openssf-slsa"
    requirementId: string;    // e.g., "level-3"
  }
  ```

**And** tool execution flow works:
1. Receive MCP tool request with framework ID + requirement ID (FR26)
2. Load framework YAML from embedded `frameworks/` directory
3. Parse YAML and find requirement by ID
4. Return structured requirement data (FR29-31)

**And** output schema matches architecture spec (lines 270-278):
```typescript
{
  framework: string;
  requirement: {
    id: string;
    level?: string;
    title: string;
    description: string;
    rationale: string;
    controls: string[];
    references: string[];
  }
}
```

**And** discovery methods work:
- `listFrameworks()` returns all available framework IDs (FR27)
  - Returns: ["openssf-slsa", "cis-kubernetes", "nist-800-190"]
- `listRequirements(frameworkId)` returns all requirements in framework (FR28)
  - Example: `listRequirements("openssf-slsa")` → ["level-1", "level-2", "level-3", "level-4"]

**And** invalid IDs are handled gracefully (FR35):
- Unknown framework ID → "Framework 'foo' not found. Available: openssf-slsa, cis-kubernetes, nist-800-190"
- Unknown requirement ID → "Requirement 'bar' not found in openssf-slsa. Available: level-1, level-2, level-3, level-4"
- Typos get suggestions: "Did you mean 'openssf-slsa'?" (Levenshtein distance)

**And** performance meets target (NFR1):
- Requirement lookup completes in < 100ms (local YAML, no network)
- Framework list/requirement list: < 10ms

**Prerequisites:** Story 4.1 (framework YAML data)

**Technical Notes:**
- MCP tool registration in server.ts
- FrameworkStore from Story 1.5 provides data access layer
- Architecture reference: lines 259-293 (fetch_framework_requirement spec)
- FR26-35: Framework lookup requirements from PRD

---

### Story 4.3: Framework Lookup Documentation & Examples

**As a** developer learning PolyAgent,
**I want** examples showing how to query framework requirements,
**So that** I understand how to look up compliance requirements conversationally.

**Acceptance Criteria:**

**Given** PolyAgent is installed
**When** I read the documentation
**Then** examples must be provided:

- `examples/lookup-slsa-requirements.md` - Tutorial: "Query SLSA requirements"
  - Shows query: "What does SLSA Level 3 require?"
  - Shows expected AI invocation of `fetch_framework_requirement`
  - Shows sample output with requirement text and references

- `examples/lookup-cis-controls.md` - Tutorial: "Find CIS Kubernetes controls"
  - Shows query: "Show me CIS control 5.2"
  - Demonstrates framework requirement lookup
  - Links to official CIS documentation

**And** README.md documents fetch_framework_requirement tool:
- Tool purpose: Access security framework requirements
- Supported frameworks: SLSA, CIS Kubernetes, NIST 800-190
- Input parameters (frameworkId, requirementId)
- Output format with sample requirement object
- List of available frameworks and how to discover requirements

**And** verification test includes framework lookup (from Story 1.6):
- `polyagent-mcp verify` fetches SLSA Level 1
- Confirms requirement data is returned correctly
- Validates offline operation (no network needed)

**And** contribution guide explains how to add frameworks:
- YAML schema for new frameworks
- How to test new framework data
- PR process for community contributions

**Prerequisites:** Story 4.2 (fetch_framework_requirement tool complete)

**Technical Notes:**
- README section: "MCP Tool Reference - fetch_framework_requirement"
- Architecture line 231: "Contribution guidelines for adding policy examples" (extend to frameworks)
- Framework data updates via npm package releases (community PRs welcome)

---

## Epic 5: Error Handling & Diagnostics

**Epic Goal:** Provide comprehensive error handling, health monitoring, and diagnostic capabilities to ensure PolyAgent is reliable and debuggable.

**User Value:** Developers get clear, actionable error messages when things go wrong, can verify the system is healthy, and have debugging tools when troubleshooting issues.

**FRs Covered:** FR50-55 (Error handling, health checks, diagnostics)

**Total Stories:** 3

---

### Story 5.1: Structured Error Handling System

**As a** developer encountering errors with PolyAgent,
**I want** clear, actionable error messages,
**So that** I can quickly understand what went wrong and how to fix it.

**Acceptance Criteria:**

**Given** any PolyAgent operation fails
**When** an error occurs
**Then** error messages must be structured and actionable (NFR51):

- Error format:
  ```typescript
  {
    error: {
      code: string;           // e.g., "POLICY_NOT_FOUND"
      message: string;        // Human-readable error
      details: object;        // Context (file path, line number, etc.)
      remediation: string;    // What user should do to fix
    }
  }
  ```

**And** common error scenarios have specific remediation (FR51):
- **Policy file not found**: "Policy file not found at {path}. Verify the file exists and path is correct."
- **Invalid JSON input**: "Input data is not valid JSON. Error: {parseError}. Check JSON syntax."
- **OPA syntax error**: "Rego syntax error at line {N}: {description}. Fix the policy syntax."
- **Missing API key**: "OpenAI API key not configured. Run `polyagent-mcp setup` or set OPENAI_API_KEY environment variable."
- **MCP connection failure**: "Failed to connect to MCP client. Ensure AI tool is configured correctly. See README for setup instructions."

**And** errors are logged with full context (FR52):
- Log level: ERROR
- Include: tool name, input parameters, error message, stack trace
- Sensitive data redacted: API keys, full policy content (log first 100 chars only)
- Timestamp and component tag for correlation

**And** error recovery maintains server stability (NFR13):
- Tool execution failures don't crash MCP server
- Server continues handling subsequent requests
- Failed requests log error but don't leak resources

**Prerequisites:** Story 1.4 (logging system)

**Technical Notes:**
- Create `src/lib/errors.ts` with error classes
- Structured errors per NFR50-51
- Architecture doesn't specify error schema, using standard practice
- All MCP tools use consistent error format

---

### Story 5.2: Health Check & Diagnostics System

**As a** developer troubleshooting PolyAgent,
**I want** health check and diagnostic commands,
**So that** I can verify components are working and identify issues quickly.

**Acceptance Criteria:**

**Given** PolyAgent MCP server is installed
**When** I run `polyagent-mcp health`
**Then** health check must verify all components (FR54):

- **MCP Server**: Check if server process is running
- **OPA WASM**: Verify WASM module loaded successfully
- **RAG System**: Check if embeddings loaded (warn if no API key configured)
- **Configuration**: Validate config file exists and is valid
- **Framework Data**: Verify all 3 framework YAML files load correctly

**And** health check output shows component status:
```
✓ MCP Server: Running
✓ OPA WASM: Loaded (version 0.70.0)
⚠ RAG System: No API key configured (degraded mode)
✓ Configuration: Valid
✓ Framework Data: 3 frameworks loaded (SLSA, CIS, NIST)
```

**And** exit codes indicate health:
- Exit code 0: All components healthy
- Exit code 1: Any component unhealthy or degraded

**And** debug mode provides detailed diagnostics (FR53):
- Enable via `POLYAGENT_DEBUG=true` or `--debug` flag
- Shows MCP protocol messages (JSON-RPC requests/responses)
- Shows tool invocation details:
  - Input parameters (redacting sensitive data)
  - Output results (truncated if large)
  - Execution time (milliseconds)
- Shows RAG search internals:
  - Query embedding generation
  - Similarity scores for top-10 results
  - Filtering applied

**And** diagnostic logs help troubleshoot connection issues:
- Log MCP handshake messages
- Log tool registration success/failure
- Log configuration loading steps
- Log component initialization (OPA, RAG, Frameworks)

**Prerequisites:** Story 1.4 (logging system)

**Technical Notes:**
- Health check can run as standalone command or MCP tool
- Debug mode via environment variable (POLYAGENT_DEBUG) or CLI flag
- Architecture reference: NFR14 (logging), FR53-54 (debug/health)
- Sensitive data redaction prevents leaking secrets in debug logs

---

### Story 5.3: Error Recovery & Graceful Degradation

**As a** developer using PolyAgent with unreliable network or missing dependencies,
**I want** the system to degrade gracefully,
**So that** partial functionality remains available even when some components fail.

**Acceptance Criteria:**

**Given** PolyAgent is running with potential issues
**When** component failures occur
**Then** graceful degradation must work:

**Scenario: Missing OpenAI API Key**
- RAG search tool (`search_policy_examples`) returns error: "RAG search unavailable. OpenAI API key not configured."
- Other tools (explain_policy_decision, fetch_framework_requirement) continue working
- Server doesn't crash or become unavailable

**Scenario: OPA WASM fails to load**
- explain_policy_decision tool returns error with OPA installation instructions (FR55)
- Suggests fallback: "Install OPA CLI and configure binaryPath in config"
- Other tools continue working

**Scenario: Framework YAML corruption**
- Affected framework returns error: "Framework data corrupted. Reinstall PolyAgent or check custom framework YAML."
- Other frameworks continue working
- Server startup succeeds with warning

**Scenario: Embedding cache corrupted**
- RAG search regenerates embeddings automatically on next setup
- Shows warning: "Embedding cache invalid. Run `polyagent-mcp setup` to regenerate."
- Other tools unaffected

**And** transient failures have retry logic (NFR13):
- OpenAI API failures: Retry 3 times with exponential backoff (1s, 2s, 4s)
- Network timeouts: Retry 2 times with 5s timeout
- After retries exhausted, return clear error to user

**And** resource cleanup prevents leaks:
- Failed evaluations release OPA WASM memory
- Failed embedding requests don't leave HTTP connections open
- Server shutdown cleans up all resources gracefully

**Prerequisites:** Stories 5.1, 5.2 (error handling + health checks)

**Technical Notes:**
- Graceful degradation per NFR13 (error recovery)
- Retry logic for transient failures (embedding API, git operations)
- Resource cleanup prevents memory leaks
- Each component operates independently (failure isolation)

---

---

## FR Coverage Matrix

This matrix ensures all 60 functional requirements from the PRD are covered by epic stories.

### MCP Server Core (FR1-6) → Epic 1

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR1 | System provides MCP server for AI tools | Epic 1 | Story 1.2 |
| FR2 | System registers 3 MCP tools on startup | Epic 1 | Story 1.2 |
| FR3 | System loads configuration from JSON file | Epic 1 | Story 1.3 |
| FR4 | System validates configuration on startup | Epic 1 | Story 1.3 |
| FR5 | System maintains persistent MCP connection | Epic 1 | Story 1.2 |
| FR6 | System logs MCP tool invocations | Epic 1 | Story 1.4 |

### Interactive Debugging Tool (FR7-15) → Epic 2

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR7 | Users can provide Rego policy file path | Epic 2 | Story 2.3 |
| FR8 | Users can provide input data (JSON) | Epic 2 | Story 2.3 |
| FR9 | Users can specify package/rule (optional) | Epic 2 | Story 2.3 |
| FR10 | System executes policy evaluation via OPA | Epic 2 | Story 2.1 |
| FR11 | System captures complete evaluation trace | Epic 2 | Story 2.2 |
| FR12 | System returns trace data (rules, results) | Epic 2 | Story 2.2 |
| FR13 | System includes rule names, line numbers, variables | Epic 2 | Story 2.2 |
| FR14 | System handles policy syntax errors | Epic 2 | Story 2.1 |
| FR15 | System supports Rego v0 and v1 syntax | Epic 2 | Story 2.1 |

### Policy Example Search (FR16-25) → Epic 3

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR16 | Users can provide natural language query | Epic 3 | Story 3.4 |
| FR17 | Users can specify result count (default 3, max 10) | Epic 3 | Story 3.4 |
| FR18 | System performs semantic search via RAG | Epic 3 | Story 3.3 |
| FR19 | System returns top-N results ranked by similarity | Epic 3 | Story 3.3 |
| FR20 | System provides repo, path, snippet, description | Epic 3 | Story 3.4 |
| FR21 | System includes metadata tags for examples | Epic 3 | Story 3.1 |
| FR22 | System supports filtering by repository source | Epic 3 | Story 3.3 |
| FR23 | System maintains embeddings for 5 repos | Epic 3 | Story 3.1 |
| FR24 | System can regenerate embeddings | Epic 3 | Story 3.2 |
| FR25 | System handles no-results with suggestions | Epic 3 | Story 3.4 |

### Framework Requirements (FR26-35) → Epic 4

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR26 | Users can query by framework + requirement ID | Epic 4 | Story 4.2 |
| FR27 | Users can list all frameworks | Epic 4 | Story 4.2 |
| FR28 | Users can list requirements within framework | Epic 4 | Story 4.2 |
| FR29 | System returns requirement text/description | Epic 4 | Story 4.2 |
| FR30 | System returns related controls/cross-references | Epic 4 | Story 4.2 |
| FR31 | System includes implementation guidance links | Epic 4 | Story 4.2 |
| FR32 | System supports OpenSSF SLSA (Levels 1-4) | Epic 4 | Story 4.1 |
| FR33 | System supports CIS Kubernetes Benchmarks | Epic 4 | Story 4.1 |
| FR34 | System supports NIST 800-190 | Epic 4 | Story 4.1 |
| FR35 | System handles invalid IDs with suggestions | Epic 4 | Story 4.2 |

### Data Management (FR36-42) → Epic 1, Epic 3

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR36 | System embeds framework data in YAML | Epic 1 | Story 1.5 |
| FR37 | System allows custom framework YAML overrides | Epic 1 | Story 1.5 |
| FR38 | System validates framework YAML schema | Epic 1 | Story 1.5 |
| FR39 | System embeds policy example index | Epic 3 | Story 3.1 |
| FR40 | System allows custom policy repos via config | Epic 3 | Story 3.1 |
| FR41 | System caches policy examples on first use | Epic 3 | Story 3.1 |
| FR42 | System periodically updates policy repos | Epic 3 | Story 3.1 |

### User Configuration (FR43-49) → Epic 1

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR43 | Users can configure embedding API key | Epic 1 | Story 1.3 |
| FR44 | Users can configure policy repos | Epic 1 | Story 1.3 |
| FR45 | Users can specify local file paths | Epic 1 | Story 1.3 |
| FR46 | Users can enable/disable individual tools | Epic 1 | Story 1.3 |
| FR47 | Users can configure logging level | Epic 1 | Story 1.3 |
| FR48 | Users can export configuration | Epic 1 | Story 1.3 |
| FR49 | System provides config validation command | Epic 1 | Story 1.3 |

### Error Handling (FR50-55) → Epic 5

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR50 | System returns structured error messages | Epic 5 | Story 5.1 |
| FR51 | System includes remediation steps in errors | Epic 5 | Story 5.1 |
| FR52 | System logs errors with full context | Epic 5 | Story 5.1 |
| FR53 | Users can enable debug mode for MCP messages | Epic 5 | Story 5.2 |
| FR54 | System provides health check endpoint | Epic 5 | Story 5.2 |
| FR55 | System handles missing OPA with suggestions | Epic 5 | Story 5.3 |

### Installation & Setup (FR56-60) → Epic 1

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR56 | Users can install via npm (single command) | Epic 1 | Story 1.6 |
| FR57 | Users can run setup wizard | Epic 1 | Story 1.6 |
| FR58 | System detects AI tools and offers setup | Epic 1 | Story 1.6 |
| FR59 | Users can verify installation with test | Epic 1 | Story 1.6 |
| FR60 | System provides upgrade documentation | Epic 1 | Story 1.6 |

---

**Coverage Validation:** ✅ All 60 FRs from PRD mapped to epic stories

**Epic Summary:**
- Epic 1 (Foundation): 6 stories covering 23 FRs (infrastructure, config, install)
- Epic 2 (Debugging): 4 stories covering 9 FRs (OPA integration, trace, MCP tool)
- Epic 3 (RAG Search): 5 stories covering 10 FRs (repos, embeddings, vector search, MCP tool)
- Epic 4 (Framework Lookup): 3 stories covering 10 FRs (framework data, MCP tool, docs)
- Epic 5 (Error Handling): 3 stories covering 6 FRs (errors, health, recovery)

**Total:** 5 epics, 21 stories, 60 FRs covered

---

_This epic breakdown provides the complete implementation roadmap for PolyAgent MVP. All functional requirements are mapped to stories with detailed BDD acceptance criteria incorporating architecture decisions. Ready for Phase 4: Sprint Planning and Implementation._

---

_This epic breakdown provides the implementation roadmap for PolyAgent MVP. All 60 FRs from PRD are mapped to specific stories with detailed acceptance criteria incorporating architecture decisions._

_Ready for Phase 4: Sprint Planning and Implementation_
