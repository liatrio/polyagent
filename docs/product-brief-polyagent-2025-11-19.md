# Product Brief: polyagent

**Date:** 2025-11-19
**Author:** ianhundere
**Context:** Greenfield MCP Server + AI Agent (Personal/Commercial/Enterprise)

---

## Executive Summary

PolyAgent is a lean MCP (Model Context Protocol) server paired with an AI agent that assists developers in bridging the gap between security framework requirements (OpenSSF, CIS, NIST, FedRAMP, etc.) and Open Policy Agent (OPA/Rego) policy implementation.

Rather than attempting to auto-generate policies from framework text—an impossible 1-to-1 mapping—PolyAgent provides intelligent assistance by serving framework requirements through MCP tools and using RAG (Retrieval Augmented Generation) to surface relevant examples from proven policy libraries (in-toto, Sigstore patterns). This enables developers to understand what frameworks require and see how others have actually implemented similar controls, accelerating informed policy development.

The tool operates at three levels: solving the creator's personal OPA workflow challenges, targeting the commercial market of DevOps/security teams managing policy-as-code, and designed with enterprise-grade governance requirements in mind.

---

## Core Vision

### Problem Statement

DevOps consultants and platform engineers working with Open Policy Agent (OPA/Rego) face a critical context gap when using AI coding assistants. AI tools lack access to security framework requirements (OpenSSF, CIS, NIST, FedRAMP), proven policy examples scattered across repositories, and live OPA evaluation engines. This forces developers into constant context switching: manually looking up framework documentation, searching GitHub for implementation patterns, copying policy snippets to AI tools, and running separate OPA CLI commands to debug evaluation traces.

The result is fragmented workflows where AI assistants provide generic Rego suggestions that miss framework-specific requirements and battle-tested patterns. Debugging requires manual CLI commands to extract evaluation traces, which developers must then interpret themselves. Policy generation happens in isolation from the wealth of working examples in community repositories (Liatrio's autogov libraries, Kubernetes Gatekeeper policies, Sigstore verification patterns, and others).

### Problem Impact

**For consultancies like Liatrio:**
- Billable time spent on context gathering rather than high-value policy development
- Junior consultants face steep learning curves finding relevant examples and understanding framework requirements
- Inconsistent quality when AI suggestions lack domain-specific context

**For platform/security engineers:**
- 30-60 minutes of manual research before writing meaningful policy code
- Debugging requires multiple tool context switches (editor → CLI → docs → back to editor)
- Risk of implementing policies that miss framework requirements or ignore proven patterns

**For the broader OPA community:**
- Wealth of proven policy patterns remains siloed across repositories
- No systematic way to leverage community knowledge during policy development
- AI coding assistants underutilized for policy-as-code due to lack of domain integration

{{#if existing_solutions_gaps}}

### Why Existing Solutions Fall Short

{{existing_solutions_gaps}}
{{/if}}

### Proposed Solution

PolyAgent creates a stateful, interactive connection between AI coding assistants and the OPA policy ecosystem through the Model Context Protocol (MCP). Rather than forcing developers to manually feed context to AI tools, PolyAgent proactively fetches and analyzes policies, framework requirements, and proven examples on behalf of the AI.

**Core architecture:**
- **MCP Server** exposing domain-specific tools for policy operations (evaluation, search, analysis)
- **RAG System** with embeddings of security frameworks and curated policy example repositories
- **OPA Integration** enabling conversational interaction with both static policies and live OPA engines

**MVP capabilities (Phase 1):**
1. **Interactive Debugging** - Conversational interface to OPA evaluation traces ("Why did this deny?" → AI fetches trace and explains in plain English)
2. **Policy Generation from Examples** - RAG-powered search over proven patterns from Liatrio autogov, Kubernetes Gatekeeper, Sigstore, Scalr, and RedHat repositories

**Future capabilities:**
3. **Impact Analysis** - Identify which policies are affected by proposed changes (API endpoints, resource paths)
4. **Compliance Auditing** - Automated scanning of policies against framework requirements (SOC2, NIST, FedRAMP) with gap flagging and remediation ticket generation
5. **Access Reporting** - Generate compliance reports by querying policies about roles, users, and permissions

### Key Differentiators

**vs. OPA CLI:**
- Conversational interface eliminates manual command execution
- AI interprets evaluation traces in plain English rather than raw JSON
- Proactive context fetching vs. reactive command-response

**vs. Generic AI Coding Assistants:**
- Domain-specific MCP tools provide OPA/Rego expertise
- RAG over curated policy examples (not generic training data)
- Direct integration with OPA engines and policy repositories

**vs. Documentation/GitHub Search:**
- Semantic search over proven patterns, not keyword matching
- Framework requirements served contextually during policy development
- No context switching between tools

**Unique approach:**
PolyAgent is assistance, not automation. It recognizes there's no 1-to-1 mapping between framework requirements and Rego policy, so it augments human developers with the right context at the right time rather than attempting to auto-generate policies.

---

## Target Users

### Primary Users

**DevOps Consultants at Liatrio and Similar Firms**

These are experienced engineers who help clients implement policy-as-code, supply chain security, and compliance automation. They work across multiple client engagements, each with different OPA policy requirements tied to various security frameworks (OpenSSF SLSA, CIS benchmarks, NIST controls, FedRAMP requirements).

**Current workflow:**
- Jump between client codebases implementing OPA policies
- Maintain mental models of where proven patterns live (autogov repos, Gatekeeper libraries, Sigstore examples)
- Manually look up framework requirements for each client's compliance needs
- Use AI coding assistants but constantly copy/paste context because tools lack policy domain knowledge
- Debug policies using OPA CLI, then explain results to clients

**What they need:**
- Instant access to framework requirements without leaving their editor
- RAG-powered search over proven policy patterns they've seen work
- Conversational debugging that explains OPA traces to clients in plain English
- Tool that makes them more effective on billable hours

**Technical comfort:** Expert level with OPA/Rego, Kubernetes, supply chain security tools (Sigstore, in-toto), and AI coding assistants (Claude Code, Cursor, GitHub Copilot)

### Secondary Users

**Platform/Security Engineers at Enterprises**

Internal platform teams responsible for implementing and maintaining OPA policies for Kubernetes admission control, API authorization, infrastructure governance, and compliance requirements. Unlike consultants who work across clients, these engineers manage a single organization's policy landscape long-term.

**Current workflow:**
- Inherit existing policies, often poorly documented
- Asked to implement new policies tied to compliance audits (SOC2, ISO 27001, FedRAMP)
- Struggle to understand impact of changes ("If I modify this policy, what breaks?")
- Generate monthly access reports for auditors manually
- Onboard junior engineers who lack policy-as-code experience

**What they need:**
- All the consultant benefits (debugging, examples, framework lookup)
- PLUS: Impact analysis for safe policy changes
- PLUS: Automated compliance auditing and reporting (future phases)
- Tool that reduces compliance prep from days to hours

**Technical comfort:** Intermediate to expert with OPA/Rego, varying familiarity with AI coding assistants

### User Journey

**Scenario: Implementing SLSA Level 3 Provenance Verification**

**Without PolyAgent:**
1. Product manager says "We need SLSA Level 3 for SOC2 audit"
2. Engineer googles "SLSA Level 3 requirements" (15 min reading docs)
3. Searches GitHub for "SLSA provenance OPA" (20 min browsing repos)
4. Finds Sigstore example, copies into Claude Code
5. Asks AI "help me implement this" (AI gives generic Rego)
6. Writes policy, tests with OPA CLI (debugging loop: 30 min)
7. Manually verifies against SLSA requirements (another 15 min)
8. **Total: 80+ minutes, uncertain if correct**

**With PolyAgent:**
1. Product manager says "We need SLSA Level 3 for SOC2 audit"
2. In Claude Code: "Help me implement SLSA Level 3 provenance verification"
3. PolyAgent MCP auto-fetches: OpenSSF SLSA L3 requirements + 3 proven examples (autogov, Sigstore)
4. AI generates policy based on requirements + working patterns
5. Engineer reviews, asks "Why would this deny a valid image?"
6. PolyAgent explains trace conversationally
7. Engineer refines and deploys
8. **Total: 15-20 minutes, high confidence**

---

## Success Metrics

### MVP Validation (Phase 1 - Weeks 1-4)

**Internal Adoption:**
- 3-5 Liatrio consultants actively using PolyAgent on client engagements
- 80%+ report "saves time vs manual lookup/debugging"
- Used on at least 2 real client projects

**Technical Validation:**
- MCP tools successfully integrated with Claude Code/Cursor
- RAG returns relevant examples 70%+ of the time
- OPA trace explanations deemed "helpful" by users

**Iteration Signal:**
- Clear feedback on which MCP tools are most valuable
- Feature requests indicating desired Phase 2 capabilities
- Evidence that consultants would miss it if removed

### Business Objectives

**For Liatrio (Short-term: 6 months):**
- **Consulting Accelerator** - Tool increases billable efficiency for OPA engagements
- **Thought Leadership** - Open source generates inbound leads from autogov/supply chain security community
- **Recruiting Tool** - Showcases technical innovation, attracts engineering talent interested in AI + security

**For Liatrio (Long-term: 12-18 months):**
- **Market Positioning** - Known as "the consultancy with AI-augmented policy expertise"
- **Community Building** - Active contributor base using/extending PolyAgent
- **Potential Commercial Layer** - If Phase 3/4 deliver enterprise compliance automation, SaaS opportunity emerges

### Key Performance Indicators

**Adoption KPIs:**
- Weekly active users (consultants using PolyAgent)
- Policies written/debugged with PolyAgent assistance
- GitHub stars / community engagement (post open-source release)

**Value KPIs:**
- Time savings: Policy development time reduction (target: 50%+)
- Quality: Policies passing framework compliance checks first-try rate
- Consultant NPS: "Would you recommend PolyAgent to colleagues?"

**Business KPIs:**
- Inbound leads mentioning PolyAgent as discovery source
- Client engagements where PolyAgent is demo'd/discussed
- Conference talk acceptances or blog post engagement metrics

---

## MVP Scope

### Core Features

**1. MCP Server Foundation**
- TypeScript/Node.js implementation using official MCP SDK
- Compatible with Claude Code, Cursor, and other MCP-enabled AI tools
- Handles authentication and connection management
- Extensible tool registration architecture

**2. Interactive Debugging (MCP Tool: `explain_policy_decision`)**
- Accepts: Rego policy file, OPA input JSON, optional package/rule specification
- Executes OPA evaluation via OPA SDK
- Captures evaluation trace showing which rules fired and why
- Returns structured trace data to AI for conversational explanation
- Enables Q&A: "Why did this deny?", "Which rule triggered?", "What would allow this?"

**3. Policy Example Search (MCP Tool: `search_policy_examples`)**
- RAG system with embeddings of curated policy repositories:
  - Liatrio autogov libraries (supply chain/attestation patterns)
  - Kubernetes Gatekeeper policies (admission control)
  - Sigstore verification examples (signature checking)
  - Scalr policies (Terraform governance)
  - RedHat policies (OpenShift/container security)
- Semantic search: Query → retrieve top 3-5 most relevant policy examples
- Returns: File path, code snippet, description of what policy does
- Enables: "Show me examples of Sigstore verification", "Find policies that check container privileges"

**4. Framework Requirements Lookup (MCP Tool: `fetch_framework_requirement`)**
- Embedded YAML/JSON data for core security frameworks:
  - OpenSSF SLSA (Levels 1-4 requirements)
  - CIS Kubernetes Benchmarks (security controls)
  - NIST 800-190 (container security guidance)
- Query by framework ID and requirement number
- Returns: Requirement text, related controls, implementation guidance links
- Enables: "What does SLSA Level 3 require?", "Show me CIS 5.2 control"

**5. Basic Documentation & Examples**
- README with installation instructions
- 3-5 example usage scenarios
- Configuration guide for common AI tools (Claude Code, Cursor)
- Contribution guidelines for adding policy examples

### Out of Scope for MVP

**Explicitly NOT included in Phase 1:**

❌ **Auto-generation of policies** - We're not attempting to generate complete, production-ready policies from framework requirements alone (impossible due to no 1-to-1 mapping)

❌ **Impact Analysis** - "What policies break if I change this endpoint?" is Phase 2 (requires Rego AST parsing and static analysis)

❌ **Compliance Auditing** - Automated scanning of policies against framework requirements is Phase 3 (requires semantic understanding of policy intent)

❌ **Report Generation** - Access reports, compliance dashboards, audit evidence collection is Phase 3-4

❌ **Live OPA Engine Management** - MCP doesn't manage/deploy OPA servers, only evaluates policies via SDK

❌ **Policy Version Control** - Git integration, drift detection, approval workflows are future phases

❌ **Custom Agent Personas** - Optional BMad-style agent files may be provided as examples, but core is MCP server only

❌ **Web UI** - Command-line/AI tool integration only; no standalone web interface

❌ **Multi-user/Team Features** - Single-user tool; no collaboration, permissions, or team management

### MVP Success Criteria

**Must achieve by end of 2-week sprint:**

✅ **Technical Functionality:**
- MCP server runs and connects to Claude Code/Cursor successfully
- All 3 core MCP tools (`explain_policy_decision`, `search_policy_examples`, `fetch_framework_requirement`) execute without errors
- RAG search returns relevant examples for common queries (Sigstore, SLSA, RBAC patterns)
- OPA evaluation traces are captured and returned correctly

✅ **Usability:**
- At least 2 Liatrio consultants complete installation and basic usage
- Consultants successfully use PolyAgent on real policy task (even simple debugging)
- Tool works "well enough" that consultants would try it again

✅ **Value Indication:**
- Consultants report tool saved time vs. manual approach (even if just 10-15 minutes)
- At least one consultant says "I would use this on my next OPA project"
- Feedback identifies which capabilities are most valuable (debugging vs examples vs framework lookup)

✅ **Decision Criteria:**
- **Proceed to Phase 2** if 2+ consultants find it useful and request additional features
- **Pivot** if feedback indicates wrong approach or MCP integration is too clunky
- **Kill** if no one finds it useful or too complex to maintain

### Future Vision

**Phase 2: Impact Analysis (Weeks 5-8)**
- MCP tool: `analyze_policy_impact`
- Static analysis of Rego AST to extract resource references
- Query: "What policies reference `/api/v1/invoices`?"
- Returns: List of affected policies with line numbers
- Enables safe refactoring and change management

**Phase 3: Compliance Auditing (Weeks 9-12)**
- MCP tool: `audit_policies_for_compliance`
- Automated scanning of policy repository against framework requirements
- Input: Framework (SOC2, NIST, FedRAMP), policy directory
- Output: Gap analysis showing which requirements lack policy coverage
- Integration with ticketing systems (GitHub Issues, Jira) for remediation tracking

**Phase 4: Reporting & Evidence (Weeks 13-16)**
- MCP tool: `generate_compliance_report`
- Query policies to answer: "Which roles can access resource X?"
- Generate audit-ready reports mapping policies to controls
- Collect evidence of policy evaluations for compliance documentation

**Phase 5: Custom Agent Personas (Optional)**
- BMad-style agent markdown files for specialized workflows:
  - `policy-developer.md` - Guides implementation of framework requirements
  - `policy-auditor.md` - Interactive compliance review sessions
  - `policy-debugger.md` - Step-by-step debugging workflows
- These use PolyAgent MCP tools but add guided orchestration
- Purely optional - MCP works standalone

**Long-term Vision:**
- Community-contributed policy example repositories
- Support for additional frameworks (ISO 27001, PCI-DSS, HIPAA)
- Integration with policy testing frameworks (like PolyProof if it exists)
- Potential SaaS offering for enterprise compliance automation

---

## Technical Preferences

### Technology Stack

**MCP Server:**
- **Language:** TypeScript/Node.js (matches MCP SDK ecosystem, familiar to team)
- **MCP SDK:** Official Anthropic MCP SDK for TypeScript
- **OPA Integration:** `@open-policy-agent/opa-wasm` or OPA Go binary via child process
- **Package Manager:** npm/pnpm

**RAG System:**
- **Embedding Model:** OpenAI text-embedding-3-small (cost-effective, good performance)
- **Vector Database:** Initial: In-memory (FAISS or similar), Future: Pinecone/Qdrant for scale
- **Chunking Strategy:** Policy-level granularity (embed entire Rego files with metadata)
- **Search:** Semantic similarity via cosine distance

**Framework Data:**
- **Format:** YAML for human readability and easy contribution
- **Storage:** Embedded in repo (`/frameworks` directory)
- **Schema:** Structured with framework ID, requirement ID, description, controls, links

**Deployment:**
- **Distribution:** npm package, installable via `npm install -g polyagent-mcp`
- **Configuration:** JSON config file for MCP server settings, policy repo paths, embedding API keys
- **AI Tool Integration:** Configuration examples for Claude Code, Cursor in README

### Architecture Principles

1. **Lean Core** - MCP server does one thing well: augment AI with policy context
2. **No Vendor Lock-in** - Works with any MCP-enabled AI tool
3. **Extensible** - Easy to add new MCP tools, frameworks, or policy repositories
4. **Offline-capable** - Embedded frameworks work without internet; RAG can work with local embeddings
5. **Open Source First** - Apache 2.0 license, community contributions welcomed

## Risks and Assumptions

### Key Assumptions

✅ **Liatrio consultants are using AI coding assistants** (Claude Code, Cursor, GitHub Copilot) for OPA/policy work
- **Validation needed:** Survey team to confirm

✅ **MCP adoption will grow** - Model Context Protocol is relatively new (2024), betting on continued adoption
- **Mitigation:** MCP is Anthropic-backed, works with Claude Code natively

✅ **RAG over policy examples adds value** - Assumes semantic search returns relevant patterns
- **Validation:** MVP tests this hypothesis

✅ **Internal dogfooding is sufficient validation** - 2-3 consultants can validate MVP usefulness
- **Risk:** Small sample size, may not represent broader market

✅ **Liatrio has leadership buy-in** - Assumes time/resources allocated for this project
- **Critical:** Confirm with leadership before heavy investment

### Risks & Mitigation Strategies

**🔴 HIGH RISK: MCP adoption remains niche**
- **Impact:** Tool only works with limited AI assistants
- **Mitigation:** MCP is Anthropic-backed, Claude Code integration is first-class
- **Fallback:** If MCP fails, could pivot to VS Code extension or CLI tool

**🟡 MEDIUM RISK: RAG doesn't return useful examples**
- **Impact:** Policy search MCP tool doesn't add value over Google
- **Mitigation:** Start with curated, high-quality repos (autogov, Gatekeeper, Sigstore)
- **Fallback:** Fall back to simple keyword search if semantic search underperforms

**🟡 MEDIUM RISK: Internal users don't adopt**
- **Impact:** Tool sits unused, no validation
- **Mitigation:** Direct outreach to consultants, integrate into onboarding
- **Fallback:** If no internal adoption, kill project quickly (2-week feedback loop)

**🟡 MEDIUM RISK: Framework data maintenance burden**
- **Impact:** Embedded YAML becomes stale as frameworks evolve
- **Mitigation:** Start with stable frameworks (OpenSSF SLSA, CIS), community contributions
- **Fallback:** Link to official docs rather than embed if maintenance too heavy

**🟢 LOW RISK: OPA evaluation integration complexity**
- **Impact:** Difficulty capturing/parsing OPA traces
- **Mitigation:** OPA SDK is well-documented, active community
- **Validation:** Prototype this first in MVP week 1

**🟢 LOW RISK: Open source gets no community traction**
- **Impact:** Only Liatrio uses it, no external adoption
- **Acceptance:** Primary value is internal consultant efficiency; external adoption is bonus
- **Note:** Even if community doesn't adopt, still wins if Liatrio consultants find it useful

### Open Questions

❓ **Which AI tools do Liatrio consultants actually use?** (Claude Code, Cursor, Copilot, other?)
❓ **What's the approval process for open sourcing?** (Legal, marketing, timing?)
❓ **Who maintains this long-term?** (Dedicated owner or community-driven?)
❓ **What's the success threshold for Phase 2 investment?** (How many consultants must find MVP useful?)
❓ **Are there existing client engagements where this could be piloted?** (Real-world validation opportunity?)

---

_This Product Brief captures the vision and requirements for polyagent._

_It was created through collaborative discovery with the BMad agent team and reflects the unique needs of this greenfield MCP server + AI agent project serving personal, commercial, and enterprise goals._

**Next Steps:**

1. **Validate Assumptions** - Survey Liatrio consultants on AI tool usage and interest in PolyAgent
2. **Secure Buy-in** - Confirm leadership approval for 2-week MVP sprint
3. **PRD Workflow** - Transform this brief into detailed product requirements document with:
   - Technical specifications for each MCP tool
   - RAG system architecture and embedding strategy
   - Framework data schema and initial content
   - Success metrics and validation plan
4. **Architecture Workflow** - Design technical architecture for:
   - MCP server structure and tool registration
   - OPA integration approach
   - RAG pipeline and vector search
   - Configuration management

_Next: Run the PRD workflow (`*prd` command with analyst agent) to create detailed planning artifacts for MVP development._
