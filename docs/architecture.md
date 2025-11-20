# PolyAgent Architecture

**Author:** Winston (Architect Agent) + ianhundere
**Date:** 2025-11-19
**Version:** 1.0
**Status:** MVP Architecture

---

## Executive Summary

PolyAgent is an MCP (Model Context Protocol) server that bridges AI coding assistants with the OPA policy ecosystem. The architecture is designed for a **2-week MVP delivering 3 core MCP tools** with a clear expansion path to compliance auditing and enterprise features.

**Core Design Principles:**
1. **Boring Technology** - TypeScript/Node.js, proven npm ecosystem, standard patterns
2. **Local-First** - Embedded framework data, optional cloud embeddings, offline-capable
3. **Lean Core** - MCP server does one thing well, extensible via plugins later
4. **Fast Startup** - < 1 second warm start, < 5 seconds cold start
5. **Developer Experience** - Zero-config for Claude Code, clear errors, good logging

**Technology Stack:**
- **Runtime:** Node.js v24.11.0 LTS (Krypton) or v22.11.0 LTS (Jod)
- **Language:** TypeScript 5.9.3
- **MCP Protocol:** @modelcontextprotocol/sdk@1.22.0
- **OPA Integration:** @open-policy-agent/opa-wasm@1.10.0
- **RAG:** OpenAI Embeddings API (text-embedding-3-small), in-memory vector store
- **Distribution:** npm package (@polyagent/mcp-server)

_Versions verified: 2025-11-19_

---

## System Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Coding Assistant                       │
│            (Claude Code, Cursor, Continue.dev)              │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol
                         │ (stdio/JSON-RPC)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  PolyAgent MCP Server                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           MCP Server Core                             │  │
│  │  - Tool Registration                                  │  │
│  │  - Connection Management                              │  │
│  │  - Request Routing                                    │  │
│  │  - Error Handling                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Tool:        │  │ Tool:        │  │ Tool:        │     │
│  │ explain_     │  │ search_      │  │ fetch_       │     │
│  │ policy_      │  │ policy_      │  │ framework_   │     │
│  │ decision     │  │ examples     │  │ requirement  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ OPA Engine  │  │  RAG System  │  │  Framework   │      │
│  │  Evaluator  │  │              │  │  Data Store  │      │
│  └─────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
  ┌────────────┐   ┌──────────────┐   ┌──────────────┐
  │ User's     │   │ Embedding    │   │ Embedded     │
  │ .rego      │   │ API          │   │ YAML Files   │
  │ Policies   │   │ (OpenAI)     │   │              │
  └────────────┘   └──────────────┘   └──────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │ Policy       │
                   │ Example      │
                   │ Repos        │
                   │ (cached)     │
                   └──────────────┘
```

### Component Responsibilities

**MCP Server Core:**
- Implements MCP protocol (JSON-RPC over stdio)
- Registers 3 tools on startup
- Routes requests to appropriate tool handlers
- Manages configuration and logging
- Handles connection lifecycle

**Tool: explain_policy_decision:**
- Accepts Rego policy path + test input
- Invokes OPA WASM engine
- Captures evaluation trace
- Formats trace for AI consumption

**Tool: search_policy_examples:**
- Accepts natural language query
- Generates query embedding
- Searches vector store for similar policies
- Returns top-N ranked results with metadata

**Tool: fetch_framework_requirement:**
- Accepts framework ID + requirement ID
- Looks up embedded YAML data
- Returns structured requirement information

---

## MCP Tool Specifications

### Tool 1: explain_policy_decision

**Purpose:** Execute Rego policy and explain evaluation trace conversationally

**Input Schema:**
```typescript
interface ExplainPolicyInput {
  policyPath: string;          // Path to .rego file
  inputData: object;            // JSON test input
  packageName?: string;         // Optional: e.g., "authz.policy"
  ruleName?: string;            // Optional: e.g., "allow"
}
```

**Output Schema:**
```typescript
interface ExplainPolicyOutput {
  result: boolean | object;     // Policy decision
  trace: EvaluationTrace[];     // Evaluation steps
  error?: string;                // If policy fails
}

interface EvaluationTrace {
  line: number;
  rule: string;
  evaluated: boolean;
  result: boolean | null;
  variables?: Record<string, any>;
}
```

**Implementation Approach:**
- Use `@open-policy-agent/opa-wasm` for evaluation
- Load policy file from disk
- Compile to WASM module
- Execute with input data
- Extract trace via OPA SDK trace API
- Format trace as structured JSON

**Error Handling:**
- Policy syntax errors → return parse error with line number
- File not found → suggest valid paths
- Invalid input JSON → return JSON validation error
- OPA WASM failure → fallback suggestion to install OPA binary

---

### Tool 2: search_policy_examples

**Purpose:** Semantic search over curated policy example repositories

**Input Schema:**
```typescript
interface SearchExamplesInput {
  query: string;                // Natural language query
  limit?: number;               // Default 3, max 10
  filterRepo?: string;          // Optional: "gatekeeper", "sigstore", etc.
}
```

**Output Schema:**
```typescript
interface SearchExamplesOutput {
  results: PolicyExample[];
  totalFound: number;
}

interface PolicyExample {
  repo: string;                 // e.g., "kubernetes/gatekeeper"
  path: string;                 // e.g., "policy/container-limits.rego"
  snippet: string;              // Code excerpt (200 lines max)
  description: string;          // What this policy does
  tags: string[];               // e.g., ["rbac", "kubernetes", "admission"]
  similarityScore: number;      // 0.0-1.0
}
```

**Implementation Approach:**

**Phase 1: Embedding Generation (Offline/Setup)**
1. Clone/download 5 curated repos:
   - `liatrio/demo-gh-autogov-policy-library`
   - `open-policy-agent/gatekeeper-library`
   - `sigstore/policy-controller/examples`
   - `scalr/policy-library`
   - `redhat-cop/rego-policies`

2. For each `.rego` file:
   - Extract metadata (package, imports, comments)
   - Generate embedding via OpenAI `text-embedding-3-small`
   - Store: `{ repoPath, fileContent, embedding, metadata }`

3. Build in-memory vector index (simple cosine similarity search)

**Phase 2: Query Search (Runtime)**
1. User provides query: "Sigstore signature verification"
2. Generate query embedding via OpenAI API
3. Compute cosine similarity with all stored embeddings
4. Return top-N results sorted by similarity
5. Include code snippet + metadata

**Data Storage:**
```
~/.polyagent/
  policy-examples/
    index.json              # Metadata index
    embeddings.bin          # Vector embeddings (binary)
    repos/
      gatekeeper/           # Cached policy files
      sigstore/
      ...
```

**Caching Strategy:**
- Embeddings cached locally (invalidate on version bump)
- Policy repos cloned once, updated periodically (configurable)
- Embedding API calls only on first setup or new repos

---

### Tool 3: fetch_framework_requirement

**Purpose:** Lookup security framework requirements by ID

**Input Schema:**
```typescript
interface FetchRequirementInput {
  frameworkId: string;          // e.g., "openssf-slsa"
  requirementId: string;        // e.g., "level-3"
}
```

**Output Schema:**
```typescript
interface FetchRequirementOutput {
  framework: string;
  requirement: {
    id: string;
    level?: string;
    title: string;
    description: string;
    rationale: string;
    controls: string[];         // Related control IDs
    references: string[];       // Links to official docs
  };
}
```

**Implementation Approach:**

**Data Format (Embedded YAML):**
```yaml
# frameworks/openssf-slsa.yaml
framework:
  id: openssf-slsa
  name: "OpenSSF SLSA (Supply-chain Levels for Software Artifacts)"
  version: "1.0"
  url: "https://slsa.dev"

requirements:
  - id: level-1
    title: "SLSA Level 1 - Provenance"
    description: "Build process must generate provenance"
    rationale: "Enables basic supply chain visibility"
    controls: ["provenance-generation"]
    references:
      - "https://slsa.dev/spec/v1.0/requirements#level-1"

  - id: level-3
    title: "SLSA Level 3 - Hardened Build"
    description: "Signed provenance, hardened build platform"
    rationale: "Prevents tampering during build"
    controls: ["signed-provenance", "hardened-build"]
    references:
      - "https://slsa.dev/spec/v1.0/requirements#level-3"
```

**Lookup Process:**
1. Load framework YAML from embedded `frameworks/` directory
2. Parse YAML, find requirement by ID
3. Return structured data
4. If not found, suggest valid IDs from framework

**Supported Frameworks (MVP):**
- `openssf-slsa`: SLSA Levels 1-4
- `cis-kubernetes`: CIS Kubernetes Benchmarks
- `nist-800-190`: Container security guidance

---

## Data Architecture

### Configuration File

**Location:** `~/.polyagent/config.json`

**Schema:**
```json
{
  "version": "1.0",
  "embedding": {
    "provider": "openai",
    "apiKey": "${OPENAI_API_KEY}",
    "model": "text-embedding-3-small"
  },
  "policyExamples": {
    "repos": [
      {
        "name": "gatekeeper",
        "url": "https://github.com/open-policy-agent/gatekeeper-library",
        "enabled": true
      },
      {
        "name": "sigstore",
        "url": "https://github.com/sigstore/policy-controller",
        "path": "examples/policies",
        "enabled": true
      }
    ],
    "updateInterval": "7d"
  },
  "opa": {
    "engine": "wasm",
    "binaryPath": null
  },
  "logging": {
    "level": "info",
    "file": "~/.polyagent/logs/mcp-server.log"
  }
}
```

### Framework Data Schema

**Location:** `node_modules/@polyagent/mcp-server/frameworks/*.yaml`

Each framework YAML follows this schema:
```yaml
framework:
  id: string               # Unique identifier
  name: string             # Display name
  version: string          # Framework version
  url: string              # Official documentation URL

requirements:
  - id: string             # Requirement identifier
    title: string          # Short title
    description: string    # Detailed description
    rationale: string      # Why this matters
    controls: string[]     # Related control IDs
    references: string[]   # Links to specs/docs
```

### Policy Example Index Schema

**Location:** `~/.polyagent/policy-examples/index.json`

```json
{
  "version": "1.0",
  "lastUpdated": "2025-11-19T12:00:00Z",
  "examples": [
    {
      "id": "gatekeeper-container-limits",
      "repo": "open-policy-agent/gatekeeper-library",
      "path": "library/pod-security-policy/container-limits.rego",
      "description": "Enforces CPU and memory limits on containers",
      "tags": ["kubernetes", "resource-limits", "admission"],
      "packageName": "container_limits",
      "embeddingVector": "..."
    }
  ]
}
```

---

## Key Architectural Decisions (ADRs)

### ADR-001: Use OPA WebAssembly over OPA Binary

**Context:** Need to execute Rego policies for debugging tool

**Decision:** Use `@open-policy-agent/opa-wasm` (WebAssembly SDK)

**Rationale:**
- ✅ No external OPA binary dependency
- ✅ Works cross-platform (macOS, Linux, Windows)
- ✅ Embeds in npm package
- ✅ Faster startup (no subprocess spawning)
- ⚠️ Lacks some advanced OPA features (bundles, discovery)

**Tradeoffs:**
- WASM has feature limitations vs full OPA
- For MVP debugging use case, WASM is sufficient
- Can add OPA binary fallback in future if needed

**Status:** Accepted for MVP

---

### ADR-002: In-Memory Vector Store over External Vector DB

**Context:** Need vector storage for RAG policy example search

**Decision:** Use in-memory vector store with local persistence

**Rationale:**
- ✅ Zero external dependencies
- ✅ Fast startup (load from disk cache)
- ✅ Sufficient for 5 repos (~500-1000 policies)
- ✅ Simple deployment (no DB to manage)
- ⚠️ Limited to single machine, no distributed search

**Tradeoffs:**
- Won't scale to 100K+ policies
- No advanced filtering/faceting
- For MVP with curated repos, in-memory is perfect
- Can migrate to Pinecone/Qdrant later if scale demands it

**Implementation:**
- Store embeddings in binary file (`embeddings.bin`)
- Load into memory on startup (< 500ms for 1K policies)
- Use simple cosine similarity for search
- No complex indexing needed at this scale

**Status:** Accepted for MVP

---

### ADR-003: Embed Framework Data vs Fetch from APIs

**Context:** Need framework requirement data (SLSA, CIS, NIST)

**Decision:** Embed YAML files in npm package

**Rationale:**
- ✅ Offline-capable (works without internet)
- ✅ Fast lookup (< 100ms, no network latency)
- ✅ Version-controlled (framework data versioned with package)
- ✅ No API rate limits or availability issues
- ⚠️ Requires manual updates when frameworks change

**Tradeoffs:**
- Framework data can become stale
- Need to release new npm version for framework updates
- Alternative (API fetch) would have latency/availability issues
- For stable frameworks (SLSA, CIS), infrequent updates are acceptable

**Update Strategy:**
- Minor version bumps for framework data updates
- Community can PR framework YAML updates
- Consider auto-update check in future (notify user of new package version)

**Status:** Accepted for MVP

---

### ADR-004: MCP Protocol over CLI or REST API

**Context:** How should AI tools interact with PolyAgent?

**Decision:** Use Model Context Protocol (MCP) as primary interface

**Rationale:**
- ✅ Native integration with Claude Code (Anthropic's tool)
- ✅ Standard protocol for AI tool augmentation
- ✅ Growing ecosystem (Cursor, Continue.dev support)
- ✅ Designed specifically for AI-tool context augmentation
- ⚠️ Newer protocol (2024), less mature than REST

**Tradeoffs:**
- MCP adoption is still growing
- If MCP fails to gain traction, could add REST API later
- For target users (AI coding assistant users), MCP is the right choice
- Alternative (CLI) would require manual invocation, breaking conversational flow

**Status:** Accepted for MVP

---

### ADR-005: TypeScript over Go or Python

**Context:** Language choice for MCP server implementation

**Decision:** TypeScript/Node.js

**Rationale:**
- ✅ MCP SDK officially supports TypeScript
- ✅ npm ecosystem for distribution
- ✅ Async I/O fits MCP request/response pattern
- ✅ Familiar to target audience (DevOps engineers use Node.js)
- ✅ Easy integration with OpenAI SDK for embeddings

**Tradeoffs:**
- Go would have better performance, smaller binary
- Python would simplify ML/embedding code
- TypeScript chosen for ecosystem fit, not performance
- Node.js performance is sufficient for MVP scale (< 10 concurrent requests)

**Status:** Accepted

---

## Deployment Architecture

### npm Package Structure

```
@polyagent/mcp-server/
├── package.json
├── bin/
│   └── polyagent-mcp         # CLI entry point
├── dist/                      # Compiled TypeScript
│   ├── server.js
│   ├── tools/
│   │   ├── explain-policy.js
│   │   ├── search-examples.js
│   │   └── fetch-framework.js
│   └── lib/
│       ├── opa-evaluator.js
│       ├── rag-engine.js
│       └── config-manager.js
├── frameworks/                # Embedded YAML
│   ├── openssf-slsa.yaml
│   ├── cis-kubernetes.yaml
│   └── nist-800-190.yaml
└── README.md
```

### Installation Flow

**Step 1: Install Package**
```bash
npm install -g @polyagent/mcp-server
```

**Step 2: Initial Setup (First Run)**
```bash
polyagent-mcp setup
```

**Setup Wizard:**
1. Detects installed AI tools (Claude Code, Cursor)
2. Prompts for OpenAI API key (for embeddings)
3. Configures MCP in tool's config file
4. Downloads & embeds policy example repos
5. Generates embeddings (one-time, ~2-3 minutes)
6. Validates setup with test query

**Step 3: Start MCP Server (Automatic)**
- AI tool launches `polyagent-mcp start` as subprocess
- MCP server listens on stdio
- Tools become available in AI conversation

### Configuration for Claude Code

**File:** `~/.claude/config.json`

```json
{
  "mcpServers": {
    "polyagent": {
      "command": "polyagent-mcp",
      "args": ["start"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

### Configuration for Cursor

**File:** `~/.cursor/mcp.json`

```json
{
  "servers": {
    "polyagent": {
      "command": "polyagent-mcp start"
    }
  }
}
```

---

## Performance Requirements

### Tool Response Times (from NFR)

| Tool | Target Latency | Notes |
|------|----------------|-------|
| `explain_policy_decision` | < 2s | For policies < 500 lines |
| `search_policy_examples` | < 1s | Includes embedding API call |
| `fetch_framework_requirement` | < 100ms | Local YAML lookup |

### Startup Performance

| Metric | Target | Strategy |
|--------|--------|----------|
| Cold start | < 5s | Lazy-load embeddings |
| Warm start | < 1s | Cache embeddings in memory |
| MCP connection | < 500ms | Minimal initialization |

### Memory Footprint

| Component | Memory Budget |
|-----------|---------------|
| MCP server process | < 200MB |
| Embedding cache | < 500MB |
| OPA WASM runtime | < 50MB |
| **Total** | **< 750MB** |

---

## Security Considerations

### API Key Management
- Store in config file outside project directory (`~/.polyagent/config.json`)
- Support environment variable override: `OPENAI_API_KEY`
- Never log API keys
- Clear warning if API key found in version control

### Code Execution Safety
- OPA WASM runs in sandboxed environment
- No arbitrary code execution from user-provided Rego
- Input validation on all MCP tool parameters
- File path validation (prevent directory traversal)

### Dependency Security
- Minimal dependency tree
- Regular `npm audit` checks
- Automated Dependabot updates for security patches
- Pin major versions, allow patch updates

### Data Privacy
- Policy code never sent to external services (except embedding API if configured)
- Local-first operation: framework data, policy evaluation all local
- Clear documentation on what data leaves user's machine (only: policy snippets to OpenAI for embedding generation)
- Option to disable embedding/RAG for full offline operation

---

## Testing Strategy

### Unit Tests (>70% coverage target)

**MCP Server Core:**
- Tool registration
- Request routing
- Error handling
- Configuration loading

**OPA Evaluator:**
- Policy loading
- Evaluation with test inputs
- Trace extraction
- Error handling (syntax errors, missing files)

**RAG Engine:**
- Embedding generation
- Vector search (cosine similarity)
- Result ranking
- Cache invalidation

**Framework Data Loader:**
- YAML parsing
- Requirement lookup
- Invalid ID handling

### Integration Tests

**End-to-End MCP Tool Tests:**
1. Start MCP server
2. Send tool request (JSON-RPC)
3. Verify response schema
4. Check response correctness

**Test Scenarios:**
- Explain valid policy → returns trace
- Explain policy with syntax error → returns error
- Search for "Sigstore" → returns relevant examples
- Fetch SLSA Level 3 → returns requirement data
- Invalid framework ID → suggests valid IDs

### Manual Testing Checklist

- [ ] Install via npm
- [ ] Run setup wizard
- [ ] Connect to Claude Code
- [ ] Invoke each MCP tool conversationally
- [ ] Verify offline mode (disable network, use embedded frameworks)
- [ ] Test error scenarios (invalid paths, malformed JSON)
- [ ] Check log output (structured, no secrets)

---

## Future Architecture Evolution

### Enhancement: Repomix for Portable Policy Context

**Context Packaging Tool:** `repomix` (https://github.com/yamadashy/repomix)

**Purpose:** Package policy repositories into portable, AI-friendly single files for enhanced RAG or direct context provision

**Use Cases:**
1. **Portable Policy Libraries** - Package Liatrio autogov repo as single XML/Markdown file for easy sharing
2. **Token-Optimized Context** - Use repomix's tree-sitter compression to reduce token count while preserving structure
3. **Alternative to Git Clone** - For small policy sets, repomix output faster than clone + index + embed
4. **Context Bundles** - Pre-package common policy patterns (Sigstore, SLSA, K8s admission) for offline use

**Integration Approach:**
- **Option A (Phase 2):** Add repomix as optional preprocessing step
  - User runs: `repomix /path/to/policy-repo` → generates `repo-context.xml`
  - PolyAgent ingests packed context instead of cloning repo
  - Benefits: Faster setup, portable, token-counted

- **Option B (Phase 3):** Hybrid RAG + Direct Context
  - Small policy sets (<100 files): Use repomix packed context (direct AI consumption, no embeddings)
  - Large policy sets (>100 files): Use RAG with embeddings (semantic search needed)
  - Let user choose per repo based on size/usage

**Repomix Features Relevant to PolyAgent:**
- XML/Markdown/JSON output (flexible format)
- Token counting (helps manage LLM context limits)
- Secretlint integration (prevents sensitive data in packaged context)
- Git-aware (includes commit history for policy evolution understanding)
- Respects .gitignore, .repomixignore (excludes irrelevant files)

**Decision:** Defer to Phase 2+ (MVP uses git clone + RAG), but architecture supports this enhancement

---

### Phase 2: Impact Analysis Tool

**New Component:** Rego AST Parser
- Parse Rego files to extract resource references
- Build reverse index: resource path → policies
- Query: "What policies reference `/api/v1/invoices`?"

**Architecture Addition:**
```
┌──────────────────────────┐
│ Tool: analyze_policy_    │
│       impact              │
└────────────┬─────────────┘
             │
             ▼
      ┌─────────────┐
      │ Rego AST    │
      │ Parser      │
      └─────────────┘
```

### Phase 3: Compliance Auditing Tool

**New Component:** Semantic Policy Analyzer
- Understand policy intent (not just syntax)
- Map policies to framework requirements
- Identify coverage gaps

**Architecture Addition:**
```
┌──────────────────────────┐
│ Tool: audit_policies_    │
│       for_compliance      │
└────────────┬─────────────┘
             │
             ▼
      ┌─────────────────┐
      │ Semantic        │
      │ Analyzer        │
      │ (LLM-powered)   │
      └─────────────────┘
```

### Phase 4: Enterprise Features

**New Components:**
- Multi-repo policy management
- Team collaboration (shared annotations)
- Audit trail logging
- Integration with governance platforms (Jira, GitHub Issues)

---

## Appendix: Technology Alternatives Considered

### OPA Integration Alternatives

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| OPA WASM SDK | No external deps, cross-platform | Limited features | ✅ Chosen for MVP |
| OPA Go Binary | Full OPA features | Requires install, subprocess overhead | 🔄 Future fallback |
| REST API to OPA Server | Centralized OPA | Network latency, requires OPA server | ❌ Rejected |

### Vector Store Alternatives

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| In-Memory (FAISS-like) | Simple, fast, no deps | Limited scale | ✅ Chosen for MVP |
| Pinecone | Scalable, managed | Cost, external dep | 🔄 Future if scale demands |
| Qdrant | Open source, feature-rich | Deployment complexity | 🔄 Future option |

### Embedding Model Alternatives

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| OpenAI text-embedding-3-small | Fast, cheap, good quality | API dependency | ✅ Chosen for MVP |
| Sentence-Transformers (local) | Offline, no cost | Slower, more complex setup | 🔄 Future offline option |
| Cohere Embed | Good multilingual support | Less common | ❌ Not needed |

---

**End of Architecture Document**

_This architecture is designed for a 2-week MVP with clear expansion paths. All major technical decisions are documented with rationale. Ready for epic breakdown and implementation._
