#!/usr/bin/env node

/**
 * PolyAgent MCP Server Entry Point
 *
 * Implements Model Context Protocol (MCP) server with stdio transport.
 * Provides policy assistance tools for AI coding assistants.
 *
 * @see https://github.com/modelcontextprotocol/specification
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Read version from package.json
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
);
const VERSION = packageJson.version;

/**
 * Initialize and start the MCP server
 */
async function main(): Promise<void> {
  // Create MCP server instance
  const server = new Server(
    {
      name: '@polyagent/mcp-server',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Handler: initialize - Returns server capabilities
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [], // Empty array - tools will be added in Epics 2-4
    };
  });

  // Handler: tools/call - No tools implemented yet
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    throw new Error(
      `Unknown tool: ${request.params.name}. No tools are registered yet. Tools will be added in Epics 2-4.`,
    );
  });

  // Error handling for uncaught errors
  server.onerror = (error) => {
    console.error('[MCP Error]', error);
  };

  // Close handler
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });

  // Create stdio transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup message after successful connection
  console.error(`PolyAgent MCP Server v${VERSION} ready`);
}

// Start the server
main().catch((error) => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
});
