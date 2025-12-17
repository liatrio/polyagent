import chalk from 'chalk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function runHealth(): Promise<void> {
  const scriptPath = process.argv[1];

  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [scriptPath, 'start'],
    });

    const client = new Client(
      {
        name: 'polyagent-health-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);

    const result: any = await client.callTool({
      name: 'system/health',
      arguments: {},
    });

    await client.close();

    if (result.content && result.content[0] && result.content[0].type === 'text') {
      const healthData = JSON.parse(result.content[0].text);
      const components = healthData.components || {};

      console.log(chalk.bold('PolyAgent Health Status'));
      console.log('=======================\n');

      // Map internal component names to display logic
      // Note: keys match what is returned by HealthService
      printComponentHealth('MCP Server', components.mcp_server);
      printComponentHealth('Configuration', components.config);
      printComponentHealth('Frameworks', components.frameworks);

      // Optional components (might not be present yet)
      if (components.opa) printComponentHealth('OPA Engine', components.opa);
      if (components.rag) printComponentHealth('RAG System', components.rag);

      const isHealthy = healthData.status === 'healthy';
      if (!isHealthy) {
        process.exit(1);
      }
    } else {
      console.error(chalk.red('Unexpected response format from health check'));
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red('Error checking health:'), err);
    // If connection failed, we assume server is down
    console.log(chalk.red('✗ MCP Server: unavailable'));
    process.exit(1);
  }
}

function printComponentHealth(name: string, component: any) {
  if (!component) return;

  const statusColor =
    component.status === 'healthy'
      ? chalk.green
      : component.status === 'degraded'
        ? chalk.yellow
        : chalk.red;

  const icon = component.status === 'healthy' ? '✓' : component.status === 'degraded' ? '⚠' : '✗';

  console.log(`${statusColor(icon)} ${chalk.bold(name)}: ${statusColor(component.status)}`);
  if (component.message) {
    console.log(`  ${chalk.gray(component.message)}`);
  }
  if (component.details) {
    if (component.details.loadedCount !== undefined) {
      console.log(`  ${chalk.gray(`Loaded: ${component.details.loadedCount}`)}`);
    }
  }
  console.log('');
}
