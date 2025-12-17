# Contributing to PolyAgent

Thank you for your interest in contributing to PolyAgent! We welcome contributions from the community.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/polyagent.git
   cd polyagent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## Architecture

PolyAgent is built as a Model Context Protocol (MCP) server using TypeScript and Node.js.

- `src/server.ts`: CLI entry point
- `src/commands/`: CLI command implementations
- `src/tools/`: MCP tool implementations
- `src/services/`: Core services (Config, Logger, Health, FrameworkStore)
- `src/lib/`: Shared libraries
- `frameworks/`: Embedded security framework data (YAML)

## Adding a New Framework

1. Create a new YAML file in `frameworks/` (e.g., `frameworks/my-new-framework.yaml`).
2. Ensure it follows the schema defined in `src/services/framework-store.ts`.
3. The `FrameworkStore` will automatically load it on startup.

## Adding a New MCP Tool

1. Create a new tool definition in `src/tools/`.
2. Define the Input Schema using Zod.
3. Register the tool in `src/server.ts` (or `src/commands/start.ts`).
4. Implement the tool logic in the `CallToolRequestSchema` handler.

## Coding Standards

- We use **ESLint** and **Prettier**. Run `npm run lint` and `npm run format` before committing.
- **Unit Tests:** All new features must have unit tests. Run `npm test` to verify.
- **Strict TypeScript:** Do not use `any` unless absolutely necessary.

## Pull Request Process

1. Fork the repo and create your branch from `main`.
2. Implement your changes and add tests.
3. Ensure `npm test` passes.
4. Submit a Pull Request with a clear description of your changes.

## License

By contributing, you agree that your contributions will be licensed under its Apache-2.0 License.
