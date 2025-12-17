import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigService } from '../config/index.js';
import { LoggerService } from '../services/logger.js';
import { HealthService } from '../services/health.js';
import { FrameworkStore } from '../services/framework-store.js';
import { HealthToolSchema } from '../tools/system.js';
import { ExplainPolicyToolSchema, executeExplainPolicy } from '../tools/explain-policy.js';
import { SearchExamplesToolSchema, executeSearchExamples } from '../tools/search-examples.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
);
const VERSION = packageJson.version;

const tools = [HealthToolSchema, ExplainPolicyToolSchema, SearchExamplesToolSchema];

/**
 * Initialize and start the MCP server
 */
export async function startServer(): Promise<void> {
  // Initialize configuration first
  const config = await ConfigService.getInstance().initialize();

  // Then initialize the logger with the loaded config
  const logger = LoggerService.initialize();
  logger.info(`[Config] Loaded configuration. Log level: ${config.server.logLevel}`);
  if (config.security.sandbox) {
    logger.info('[Config] Sandbox mode enabled');
  }

  // Initialize FrameworkStore (loads embedded and custom frameworks)
  try {
    await FrameworkStore.getInstance().initialize();
  } catch (error) {
    logger.error(error, 'Failed to initialize FrameworkStore');
    throw error;
  }

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

  // Handler: tools/list - Returns available tools
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    LoggerService.getLogger().debug({ request }, 'Handling tools/list request');
    const response = {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSchema: { type: 'object', ...zodToJsonSchema(tool.input as any, { $refStrategy: 'none' }) },
      })),
    };
    LoggerService.getLogger().debug({ response }, 'Responding to tools/list request');
    return response;
  });

  // Handler: tools/call - Executes a tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    LoggerService.getLogger().debug({ request }, 'Handling tools/call request');
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'system/health':
        // Validate input against the tool's Zod schema
        HealthToolSchema.input.parse(args);
        const health = HealthService.getInstance().getHealth();
        LoggerService.getLogger().debug({ response: health }, 'Responding to system/health call');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(health, null, 2),
            },
          ],
        };

      case 'explain_policy_decision': {
        // AC-2.3.1: Tool registered with name explain_policy_decision
        const validatedArgs = ExplainPolicyToolSchema.input.parse(args);
        const startTime = performance.now();
        LoggerService.getLogger().info({ policyPath: validatedArgs.policyPath }, 'explain_policy_decision invoked');

        const result = await executeExplainPolicy(validatedArgs);

        const executionTime = performance.now() - startTime;
        LoggerService.getLogger().info({ executionTime, policyPath: validatedArgs.policyPath }, 'explain_policy_decision completed');

        if (result.error) {
          // AC-2.3.11: Log errors with details (stack traces captured in error object)
          LoggerService.getLogger().error(
            { error: result.error, policyPath: validatedArgs.policyPath, stack: new Error().stack },
            'explain_policy_decision error'
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_policy_examples': {
        // AC-3.4.1: Tool registered with name search_policy_examples
        const validatedArgs = SearchExamplesToolSchema.input.parse(args);
        const startTime = performance.now();

        const result = await executeSearchExamples(validatedArgs);

        const executionTime = performance.now() - startTime;
        LoggerService.getLogger().debug({ executionTime }, 'search_policy_examples execution time');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        LoggerService.getLogger().error(`Unknown tool call: ${name}`);
        throw new Error(`Unknown tool: ${name}.`);
    }
  });

  // Error handling for uncaught errors
  server.onerror = (error) => {
    LoggerService.getLogger().error(error, '[MCP Error]');
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
  LoggerService.getLogger().info(`PolyAgent MCP Server v${VERSION} ready`);
}
