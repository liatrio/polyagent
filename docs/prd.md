# polyagent - Product Requirements Document

**Author:** ianhundere
**Date:** 2025-11-19
**Version:** 1.0

---

## Executive Summary

PolyAgent is an MCP (Model Context Protocol) server that creates a stateful, interactive connection between AI coding assistants and the OPA (Open Policy Agent) ecosystem. It augments AI tools with domain-specific capabilities: fetching security framework requirements (OpenSSF SLSA, CIS, NIST), searching curated policy example repositories via RAG, and providing conversational explanations of OPA evaluation traces.

The tool addresses a critical gap: AI coding assistants lack context about policy-as-code. Developers waste 30-60 minutes per policy manually looking up framework requirements, searching for proven implementation patterns across GitHub, and debugging OPA traces with CLI tools. PolyAgent eliminates this context switching by proactively serving the right information to AI at the right time.

Initial MVP (2 weeks) delivers three core MCP tools: interactive debugging, RAG-powered example search, and framework requirement lookup. Future phases add impact analysis, compliance auditing, and automated reporting for enterprise governance workflows.

### What Makes This Special

**Assistance, not automation.** PolyAgent recognizes the fundamental truth: there's no 1-to-1 mapping between framework requirements and Rego policy. Rather than attempting impossible auto-generation, it augments human developers with precisely the context they need - proven examples, framework text, evaluation explanations - enabling informed policy development instead of replacing human judgment.

---

## Project Classification

**Technical Type:** Developer Tool (MCP Server)
**Domain:** General / DevOps Tooling
**Complexity:** Medium

PolyAgent is a developer tool in the form of an MCP (Model Context Protocol) server distributed as an npm package. It integrates with AI coding assistants (Claude Code, Cursor, and other MCP-enabled tools) to augment them with OPA/Rego policy domain expertise.

**Technical Classification Rationale:**
- **Developer Tool:** Primary users are software engineers, distributed via npm, requires IDE/editor integration
- **Infrastructure/Tooling Domain:** Serves developers working on policy-as-code, not domain-regulated
- **Medium Complexity:** Involves MCP protocol implementation, RAG system, OPA SDK integration, but no regulatory/compliance requirements for the tool itself (though it helps users meet compliance)

{{#if domain_context_summary}}

### Domain Context

{{domain_context_summary}}
{{/if}}

---

## Success Criteria

**MVP Success (2-week sprint):**
- 3 MCP tools (`explain_policy_decision`, `search_policy_examples`, `fetch_framework_requirement`) functional and integrated with Claude Code/Cursor
- RAG search returns relevant policy examples for common queries (Sigstore, SLSA, RBAC) with 70%+ relevance
- OPA trace evaluation and explanation works correctly for standard policy patterns
- Tool successfully reduces policy development research time by 50%+ in test scenarios

**Adoption Success (3 months post-launch):**
- 50+ developers install and configure PolyAgent
- 20+ weekly active users (developers actively using MCP tools)
- 10+ GitHub stars/community engagement signals
- Positive feedback on at least 2 of 3 core capabilities (debugging, examples, framework lookup)

**Community Success (6-12 months):**
- Active contributor base adding policy examples or framework data
- Integration showcased in OPA community channels
- Feature requests indicating Phase 2/3 demand (impact analysis, compliance auditing)
- Recognition as "the MCP server for policy-as-code"

{{#if business_metrics}}

### Business Metrics

{{business_metrics}}
{{/if}}

---

## Product Scope

### MVP - Minimum Viable Product

**Phase 1 (Weeks 1-2): Core MCP Server + 3 Tools**

1. **MCP Server Foundation**
   - TypeScript/Node.js implementation using Anthropic MCP SDK
   - Tool registration and connection management
   - Configuration system for API keys, repo paths, embedding settings
   - Works with Claude Code and Cursor out of the box

2. **Tool 1: Interactive Policy Debugging (`explain_policy_decision`)**
   - Execute Rego policy with test input
   - Capture OPA evaluation trace
   - Return structured trace data for AI explanation
   - Support custom package/rule targeting

3. **Tool 2: Policy Example Search (`search_policy_examples`)**
   - RAG system with embeddings of 5 curated repos (Liatrio autogov, Gatekeeper, Sigstore, Scalr, RedHat)
   - Semantic search returning top 3-5 relevant examples
   - Return code snippets with context (file path, description, use case)

4. **Tool 3: Framework Requirement Lookup (`fetch_framework_requirement`)**
   - Embedded YAML data for OpenSSF SLSA, CIS Kubernetes, NIST 800-190
   - Query by framework + requirement ID
   - Return requirement text, controls, implementation guidance

5. **Distribution & Documentation**
   - npm package installable globally or as dev dependency
   - README with setup for Claude Code/Cursor
   - 3-5 example usage scenarios
   - Contribution guide for adding policy examples

### Growth Features (Post-MVP)

**Phase 2 (Weeks 3-4): Impact Analysis**
- MCP tool: `analyze_policy_impact`
- Static analysis of Rego AST to extract resource references
- Query which policies reference specific paths/resources
- Enables safe refactoring

**Phase 3 (Weeks 5-8): Compliance Auditing**
- MCP tool: `audit_policies_for_compliance`
- Scan policy repository against framework requirements
- Gap analysis showing missing coverage
- Integration with GitHub Issues/Jira for remediation tracking

**Phase 4 (Weeks 9-12): Reporting & Evidence**
- MCP tool: `generate_compliance_report`
- Query policies for access patterns (who can access what)
- Generate audit-ready reports
- Evidence collection for compliance documentation

### Vision (Future)

**Community & Ecosystem (6-12 months)**
- Community-contributed policy example repos
- Plugin system for custom MCP tools
- Support for additional frameworks (ISO 27001, PCI-DSS, HIPAA)
- Integration with policy testing frameworks

**Enterprise Features (12+ months)**
- Multi-repo policy management
- Team collaboration features (shared examples, annotations)
- SaaS offering for enterprise compliance automation
- Integration with governance platforms

---

{{#if domain_considerations}}

## Domain-Specific Requirements

{{domain_considerations}}

This section shapes all functional and non-functional requirements below.
{{/if}}

---

{{#if innovation_patterns}}

## Innovation & Novel Patterns

{{innovation_patterns}}

### Validation Approach

{{validation_approach}}
{{/if}}

---

## Developer Tool Specific Requirements

### Language & Runtime Support

**Primary:** TypeScript/Node.js (v18+)
- MCP SDK is TypeScript-native
- npm ecosystem for distribution
- Familiar to target audience (DevOps engineers, platform teams)

**OPA Integration:**
- Option A: `@open-policy-agent/opa-wasm` (WebAssembly, no external dependencies)
- Option B: OPA Go binary via child process (more features, requires OPA installed)
- MVP uses Option A for simplicity; Option B for advanced users

### Package Distribution

**npm Package:**
- Global install: `npm install -g @polyagent/mcp-server`
- Local dev dependency: `npm install --save-dev @polyagent/mcp-server`
- Scoped package (@polyagent) for brand consistency

**Versioning:**
- Semantic versioning (semver)
- Clear changelog for MCP tool additions/changes
- Separate versioning for embedded framework data

### IDE/Editor Integration

**Primary Targets:**
- **Claude Code** - First-class MCP support, official Anthropic tool
- **Cursor** - MCP support via configuration
- **Continue.dev** - MCP-compatible AI coding assistant

**Integration Method:**
- MCP configuration file (JSON) in user's config directory
- Auto-discovery of installed PolyAgent package
- Configuration wizard for first-time setup

**Requirements:**
- Zero-config start for Claude Code (MCP native)
- Documented config examples for Cursor/Continue
- Clear error messages if MCP connection fails

### Documentation Requirements

**README.md (Primary):**
- Quick start (5-minute setup)
- MCP tool reference (all 3 tools with examples)
- Configuration options
- Troubleshooting common issues

**Examples Directory:**
- Example 1: "Debug why my policy denies valid input"
- Example 2: "Find Sigstore verification examples"
- Example 3: "Lookup SLSA Level 3 requirements"
- Example 4: "Complete workflow - implement new policy with PolyAgent"

**API Documentation:**
- MCP tool schemas (JSON Schema for each tool)
- Framework data schema (YAML structure)
- Policy example metadata format

**Contributing Guide:**
- How to add new policy examples
- How to update framework data
- How to propose new MCP tools
- Code style and testing requirements

{{#if endpoint_specification}}

### API Specification

{{endpoint_specification}}
{{/if}}

{{#if authentication_model}}

### Authentication & Authorization

{{authentication_model}}
{{/if}}

{{#if platform_requirements}}

### Platform Support

{{platform_requirements}}
{{/if}}

{{#if device_features}}

### Device Capabilities

{{device_features}}
{{/if}}

{{#if tenant_model}}

### Multi-Tenancy Architecture

{{tenant_model}}
{{/if}}

{{#if permission_matrix}}

### Permissions & Roles

{{permission_matrix}}
{{/if}}
{{/if}}

---

{{#if ux_principles}}

## User Experience Principles

{{ux_principles}}

### Key Interactions

{{key_interactions}}
{{/if}}

---

## Functional Requirements

### MCP Server Core

**FR1:** The system provides an MCP server that AI tools can connect to via the Model Context Protocol
**FR2:** The system registers three MCP tools on startup: `explain_policy_decision`, `search_policy_examples`, `fetch_framework_requirement`
**FR3:** The system loads configuration from a JSON config file specifying API keys, repository paths, and embedding settings
**FR4:** The system validates required configuration on startup and reports missing values with clear error messages
**FR5:** The system maintains persistent connection with MCP clients and handles reconnection gracefully
**FR6:** The system logs MCP tool invocations with timestamps for debugging and usage tracking

### Interactive Policy Debugging (Tool: explain_policy_decision)

**FR7:** Users can provide a Rego policy file path to evaluate
**FR8:** Users can provide input data (JSON) to test the policy against
**FR9:** Users can optionally specify which OPA package and rule to evaluate (defaults to auto-detection)
**FR10:** The system executes the policy evaluation using OPA SDK/engine
**FR11:** The system captures the complete evaluation trace showing which rules were evaluated
**FR12:** The system returns trace data indicating which rules succeeded, failed, or were not evaluated
**FR13:** The system includes in trace results: rule names, line numbers, evaluation results, and any variables referenced
**FR14:** The system handles policy syntax errors and returns clear error messages to the AI
**FR15:** The system supports evaluation of policies using both Rego v0 and v1 syntax

### Policy Example Search (Tool: search_policy_examples)

**FR16:** Users can provide a natural language query describing the policy pattern they're looking for
**FR17:** Users can optionally specify the number of results to return (default: 3, max: 10)
**FR18:** The system performs semantic search over embedded policy examples using RAG
**FR19:** The system returns the top N most relevant policy examples ranked by similarity score
**FR20:** For each result, the system provides: repository source, file path, code snippet, and description
**FR21:** The system includes metadata tags for each example (e.g., "sigstore", "slsa", "rbac", "kubernetes")
**FR22:** The system supports filtering by repository source (e.g., only search Gatekeeper examples)
**FR23:** The system maintains embeddings for policy examples from 5 curated repositories (Liatrio autogov, Gatekeeper, Sigstore, Scalr, RedHat)
**FR24:** The system can regenerate embeddings when new policy examples are added
**FR25:** The system handles queries with no relevant results by suggesting alternative search terms

### Framework Requirement Lookup (Tool: fetch_framework_requirement)

**FR26:** Users can query for requirements by framework ID and requirement ID (e.g., "openssf-slsa", "level-3")
**FR27:** Users can list all available frameworks in the system
**FR28:** Users can list all requirements within a specific framework
**FR29:** The system returns requirement text, description, and rationale
**FR30:** The system returns related controls and cross-references to other frameworks
**FR31:** The system includes implementation guidance or links to official documentation
**FR32:** The system supports OpenSSF SLSA (Levels 1-4) requirements
**FR33:** The system supports CIS Kubernetes Benchmarks security controls
**FR34:** The system supports NIST 800-190 container security guidance
**FR35:** The system handles invalid framework/requirement IDs with suggestions for correct IDs

### Data Management

**FR36:** The system embeds framework requirement data in YAML format within the package
**FR37:** The system allows users to override embedded framework data with custom YAML files
**FR38:** The system validates framework YAML schema on load and reports validation errors
**FR39:** The system embeds policy example index with metadata (repo, path, tags, description)
**FR40:** The system allows users to add custom policy example repositories via configuration
**FR41:** The system downloads and caches policy examples from configured repositories on first use
**FR42:** The system periodically checks for updates to policy example repositories (configurable interval)

### User Configuration

**FR43:** Users can configure embedding API key (OpenAI) for RAG search
**FR44:** Users can configure which policy example repositories to include
**FR45:** Users can specify local file paths for custom policy examples
**FR46:** Users can enable/disable individual MCP tools
**FR47:** Users can configure logging level (error, warn, info, debug)
**FR48:** Users can export current configuration to share with team members
**FR49:** The system provides a configuration validation command to check setup before use

### Error Handling & Diagnostics

**FR50:** The system returns structured error messages that AI tools can interpret
**FR51:** The system includes actionable remediation steps in error messages
**FR52:** The system logs all errors with context (tool called, inputs provided, stack trace)
**FR53:** Users can enable debug mode to see detailed MCP protocol messages
**FR54:** The system provides a health check endpoint to verify all dependencies are available
**FR55:** The system gracefully handles missing OPA binary/SDK and suggests installation

### Installation & Setup

**FR56:** Users can install PolyAgent via npm with a single command
**FR57:** Users can run a setup wizard that guides configuration for their AI tool (Claude Code, Cursor)
**FR58:** The system detects installed AI tools and offers tool-specific setup instructions
**FR59:** Users can verify installation with a test command that exercises all 3 MCP tools
**FR60:** The system provides upgrade path documentation for migrating between versions

---

## Non-Functional Requirements

### Performance

**NFR1: MCP Tool Response Time**
- `explain_policy_decision`: < 2 seconds for policies under 500 lines
- `search_policy_examples`: < 1 second for semantic search queries
- `fetch_framework_requirement`: < 100ms for embedded data lookup

**NFR2: RAG Search Quality**
- 70%+ relevance rate for common policy patterns (Sigstore, SLSA, RBAC, K8s admission)
- Top-3 results include at least one highly relevant example for well-formed queries

**NFR3: Memory Footprint**
- MCP server process: < 200MB RAM for typical usage
- Embedding cache: < 500MB for 5 curated repositories
- Incremental loading for large policy example sets

**NFR4: Startup Time**
- Cold start (first run): < 5 seconds
- Warm start (with cached embeddings): < 1 second
- MCP connection establishment: < 500ms

### Security

**NFR5: API Key Management**
- Embedding API keys stored in user config (not in code/repo)
- Support for environment variable overrides
- Clear warnings if API keys exposed in logs

**NFR6: Code Execution Safety**
- Policy evaluation runs in sandboxed OPA environment
- No arbitrary code execution from user-provided Rego
- Input validation for all MCP tool parameters

**NFR7: Dependency Security**
- Regular security audits via npm audit
- Automated dependency updates for security patches
- Minimal dependency tree to reduce attack surface

**NFR8: Data Privacy**
- Policy code and evaluation results never sent to external services (except embedding API if enabled)
- Local-first operation mode (embedded frameworks work offline)
- Clear documentation on what data leaves the user's machine

### Integration

**NFR9: MCP Protocol Compliance**
- Full compliance with MCP specification (version as of 2024)
- Graceful degradation if MCP protocol evolves
- Clear versioning of supported MCP features

**NFR10: AI Tool Compatibility**
- Verified working with Claude Code (primary target)
- Verified working with Cursor
- Documented compatibility with Continue.dev and other MCP clients

**NFR11: OPA Version Support**
- Support OPA v0.40+ (covers majority of installations)
- Clear documentation of version-specific features
- Fallback behavior if OPA features unavailable

**NFR12: Cross-Platform Support**
- Works on macOS, Linux, Windows (wherever Node.js runs)
- Handles platform-specific path differences
- No platform-specific dependencies

### Reliability

**NFR13: Error Recovery**
- MCP server recovers from tool execution failures without crashing
- Failed policy evaluations don't break the connection
- Retry logic for transient embedding API failures

**NFR14: Logging & Debugging**
- Structured logging compatible with standard log aggregators
- Debug mode provides detailed diagnostics without exposing secrets
- Log rotation to prevent unbounded disk usage

### Maintainability

**NFR15: Code Quality**
- TypeScript with strict type checking
- Unit test coverage > 70% for core functionality
- Integration tests for all 3 MCP tools

**NFR16: Documentation**
- Inline code comments for complex logic
- README kept up-to-date with latest features
- Breaking changes clearly documented in changelog

**NFR17: Extensibility**
- Plugin architecture for adding new MCP tools
- Schema-driven framework data (easy to add new frameworks)
- Clear contribution guidelines for community additions

{{#if no_nfrs}}
_No specific non-functional requirements identified for this project type._
{{/if}}

---

---

_This PRD captures the essence of **polyagent** - an MCP server that bridges the gap between AI coding assistants and the OPA policy ecosystem, providing intelligent assistance (not automation) through stateful connections to framework requirements, proven examples, and policy evaluation capabilities._

**Requirements Summary:**
- 60 Functional Requirements covering MCP server core, 3 tools (debugging, example search, framework lookup), data management, configuration, and installation
- 17 Non-Functional Requirements covering performance, security, integration, reliability, and maintainability
- Developer tool architecture: TypeScript/Node.js, npm distribution, Claude Code/Cursor integration
- 2-week MVP delivering core value proposition with clear expansion path

**Next Steps:**
1. **Architecture Workflow** - Design technical implementation (MCP server structure, RAG pipeline, OPA integration)
2. **Epic Breakdown** - Transform FRs into implementable stories
3. **Implementation** - Build MVP in 2-week sprint with community validation

_Created through collaborative discovery between ianhundere and John (Product Manager AI)._
_Based on Product Brief from party mode session with BMad agent team._
