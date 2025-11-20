# Story 1.1: Project Setup & Build System

Status: ready-for-dev

## Story

As a **developer building PolyAgent**,
I want **a properly initialized TypeScript/Node.js project with MCP SDK integration**,
so that **I can start implementing MCP tools with proper type safety and build configuration**.

## Acceptance Criteria

### AC-1: TypeScript Project Initialized

**Given** I'm starting the PolyAgent project
**When** I run project initialization
**Then** the following must exist:

- `package.json` with:
  - name: `@polyagent/mcp-server`
  - version: `0.1.0`
  - main: `dist/server.js`
  - bin: `{ "polyagent-mcp": "dist/server.js" }`
  - engines: `{ "node": ">=22.0.0" }`
  - scripts: `build`, `test`, `lint`, `dev`

- Dependencies:
  - `@modelcontextprotocol/sdk@1.22.0`
  - `@open-policy-agent/opa-wasm@1.10.0`
  - `js-yaml@^4.1.0`
  - `pino@^9.0.0`
  - `pino-pretty@^11.0.0`

- Dev Dependencies:
  - `typescript@5.9.3`
  - `@types/node@^22.0.0`
  - `@types/js-yaml@^4.0.9`
  - `jest@^29.7.0`
  - `ts-jest@^29.1.0`
  - `@types/jest@^29.5.0`
  - `eslint@^9.0.0`
  - `@typescript-eslint/parser@^8.0.0`
  - `@typescript-eslint/eslint-plugin@^8.0.0`
  - `prettier@^3.3.0`

[Source: epics.md lines 70-75, tech-spec-epic-1.md Dependencies section]

### AC-2: TypeScript Configuration

**Given** TypeScript project initialized
**When** `tsconfig.json` is created
**Then** configuration must include:

- `compilerOptions`:
  - `strict`: true
  - `target`: "ES2022"
  - `module`: "commonjs"
  - `moduleResolution`: "node"
  - `outDir`: "dist"
  - `rootDir`: "src"
  - `esModuleInterop`: true
  - `skipLibCheck`: true
  - `forceConsistentCasingInFileNames`: true
  - `declaration`: true
- `include`: ["src/**/*"]
- `exclude`: ["node_modules", "dist", "__tests__"]

[Source: epics.md line 76, ADR-005 in architecture.md]

### AC-3: Build System Works

**Given** project structure exists
**When** I run build commands
**Then** the following must succeed:

- `npm run build`: Compiles TypeScript `src/` → `dist/`, exits 0
- `npm test`: Runs Jest (even if no tests yet), exits 0
- `npm run lint`: Runs ESLint on `src/**/*.ts`, exits 0
- `npm run dev`: Watches TypeScript and rebuilds on changes

[Source: epics.md lines 78-79, 94-95]

### AC-4: Project Structure

**Given** initialization complete
**When** I inspect the directory
**Then** structure must match:

```
/
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── README.md
├── LICENSE (Apache 2.0)
├── src/
│   ├── server.ts          # MCP server entry point
│   ├── tools/             # MCP tool implementations (empty for now)
│   ├── lib/               # Shared libraries
│   └── types/             # TypeScript type definitions
├── __tests__/
│   ├── unit/
│   └── integration/
├── frameworks/            # Framework YAML data
│   ├── openssf-slsa.yaml
│   ├── cis-kubernetes.yaml
│   └── nist-800-190.yaml
└── bin/
    └── polyagent-mcp      # CLI entry point
```

[Source: epics.md lines 82-92, architecture.md lines 447-460, tech-spec-epic-1.md Services section]

### AC-5: Git Initialized

**Given** project structure exists
**When** Git is initialized
**Then** repository must have:

- `.gitignore` with:
  ```
  node_modules/
  dist/
  .env
  .env.*
  *.log
  .DS_Store
  coverage/
  .nyc_output/
  ```
- Initial commit: "chore: initialize PolyAgent MCP server project"
- README.md with project description and quick start placeholder

[Source: epics.md line 81]

---

## Tasks / Subtasks

- [ ] **Task 1:** Initialize Node.js project (AC: #1, #4)
  - [ ] 1.1: Create project directory structure (src/, __tests__/, frameworks/, bin/)
  - [ ] 1.2: Run `npm init -y` and edit package.json (name, version, bin, engines, scripts)
  - [ ] 1.3: Install production dependencies (@modelcontextprotocol/sdk@1.22.0, @open-policy-agent/opa-wasm@1.10.0, js-yaml, pino, pino-pretty)
  - [ ] 1.4: Install dev dependencies (typescript@5.9.3, jest, ts-jest, eslint, prettier, @types/*)

- [ ] **Task 2:** Configure TypeScript (AC: #2, #3)
  - [ ] 2.1: Create `tsconfig.json` with strict mode, ES2022 target, output to dist/
  - [ ] 2.2: Verify `npm run build` compiles (even with empty src/)
  - [ ] 2.3: Create `src/server.ts` stub with minimal MCP server placeholder

- [ ] **Task 3:** Configure Testing (AC: #3)
  - [ ] 3.1: Create `jest.config.js` for TypeScript + Node environment
  - [ ] 3.2: Configure ts-jest preset
  - [ ] 3.3: Set test paths: `__tests__/**/*.test.ts`
  - [ ] 3.4: Verify `npm test` runs (exits 0 even with no tests)

- [ ] **Task 4:** Configure Linting & Formatting (AC: #3)
  - [ ] 4.1: Create `.eslintrc.json` with TypeScript parser and recommended rules
  - [ ] 4.2: Create `.prettierrc` with consistent style (2 spaces, single quotes, trailing commas)
  - [ ] 4.3: Add lint scripts to package.json: `lint`, `lint:fix`, `format`
  - [ ] 4.4: Verify `npm run lint` passes on stub files

- [ ] **Task 5:** Initialize Git (AC: #5)
  - [ ] 5.1: Run `git init`
  - [ ] 5.2: Create `.gitignore` (node_modules, dist, .env, logs, coverage)
  - [ ] 5.3: Create initial README.md with project description
  - [ ] 5.4: Create LICENSE file (Apache 2.0)
  - [ ] 5.5: Initial commit: "chore: initialize PolyAgent MCP server project"

- [ ] **Task 6:** Create Framework Data Placeholders (AC: #4)
  - [ ] 6.1: Create `frameworks/` directory
  - [ ] 6.2: Create placeholder YAML files (empty but valid schema):
    - `frameworks/openssf-slsa.yaml`
    - `frameworks/cis-kubernetes.yaml`
    - `frameworks/nist-800-190.yaml`
  - [ ] 6.3: Each YAML includes minimal framework metadata (id, name, version, url, empty requirements array)

- [ ] **Task 7:** Validate Build & Test System (AC: #3)
  - [ ] 7.1: Run `npm run build` → verify dist/ created, exits 0
  - [ ] 7.2: Run `npm test` → verify Jest runs, exits 0
  - [ ] 7.3: Run `npm run lint` → verify ESLint passes, exits 0
  - [ ] 7.4: Test watch mode: `npm run dev` → verify TypeScript recompiles on file changes

---

## Dev Notes

### Architecture References

**ADR-005 (TypeScript over Go/Python):**
- Rationale: MCP SDK native TypeScript support, npm ecosystem fit
- Source: architecture.md lines 242-253

**Technology Stack (Verified Versions):**
- Node.js: v24.11.0 LTS (Krypton) or v22.11.0 LTS (Jod)
- TypeScript: 5.9.3 (latest stable, verified 2025-11-19)
- MCP SDK: @modelcontextprotocol/sdk@1.22.0 (verified 2025-11-19)
- OPA WASM: @open-policy-agent/opa-wasm@1.10.0 (verified 2025-11-19)
- Source: architecture.md lines 21-29

**Package Structure:**
- npm scoped package: `@polyagent/mcp-server`
- Binary: `bin/polyagent-mcp` → `dist/server.js`
- Source: architecture.md lines 447-460

### Testing Standards

**Unit Test Requirements (NFR15):**
- Coverage target: >70%
- Framework: Jest with ts-jest
- Location: `__tests__/unit/`
- Source: architecture.md lines 463-466, tech-spec-epic-1.md Test Strategy

**Integration Test Requirements:**
- Location: `__tests__/integration/`
- Covers end-to-end MCP tool flows
- Source: architecture.md lines 540-547

### Security Considerations

**Dependency Security (NFR7):**
- Minimal dependency tree (only MCP SDK, OPA WASM, logging, YAML parser)
- Run `npm audit` during CI/CD
- Pin major versions, allow patch updates
- Source: architecture.md lines 417-421, tech-spec-epic-1.md Dependencies

**API Key Management (NFR5):**
- Not applicable to Story 1.1 (config system in Story 1.3)
- Note for future: Keys stored in `~/.polyagent/config.json`, never in code/repo

### Project Structure Notes

**Follows architecture spec:**
- `src/server.ts`: MCP server entry point (Story 1.2 implements)
- `src/tools/`: MCP tool handlers (Epics 2-4 implement)
- `src/lib/`: Shared libraries (config-manager, logger, framework-store in Stories 1.3-1.5)
- `src/types/`: TypeScript interfaces (shared types)
- Source: architecture.md lines 447-460

**Module Organization (per tech-spec-epic-1.md):**
- server.ts depends on: config-manager, logger, framework-store
- All modules use logger for structured logging
- CLI (bin/polyagent-mcp) depends on: server, config-manager, health-check

### Learnings from Previous Story

First story in epic - no predecessor context.

### References

- **Epics:** docs/epics.md lines 57-103 (Story 1.1 definition)
- **Tech Spec:** docs/sprint-artifacts/tech-spec-epic-1.md (Dependencies, Services, Data Models)
- **Architecture:** docs/architecture.md lines 21-29 (technology stack), 447-460 (package structure), 242-253 (ADR-005)
- **PRD:** docs/prd.md (foundational requirements enabling all FRs)

---

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/1-1-project-setup-build-system.context.xml

### Agent Model Used

<!-- Will be filled by dev agent during implementation -->

### Debug Log References

<!-- Dev agent logs implementation issues here -->

### Completion Notes List

<!-- Dev agent documents:
- New services created
- Architectural decisions made
- Technical debt deferred
- Recommendations for next story
-->

### File List

<!-- Dev agent lists:
- NEW: files created
- MODIFIED: files changed
- DELETED: files removed
-->

---

_Story created by Bob (Scrum Master) using YOLO mode - complete draft from epics + tech-spec + architecture context._
