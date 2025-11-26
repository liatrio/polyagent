#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './commands/start.js';
import { runSetup } from './commands/setup.js';
import { runVerify } from './commands/verify.js';
import { runHealth } from './commands/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('polyagent-mcp')
  .description('PolyAgent MCP Server CLI')
  .version(packageJson.version);

program
  .command('start', { isDefault: true })
  .description('Start the MCP server (default)')
  .action(async () => {
    await startServer();
  });

program
  .command('setup')
  .description('Run the interactive setup wizard')
  .action(async () => {
    await runSetup();
  });

program
  .command('verify')
  .description('Verify installation and configuration')
  .action(async () => {
    await runVerify();
  });

program
  .command('health')
  .description('Check health of the PolyAgent MCP server components')
  .action(async () => {
    await runHealth();
  });

program.parse(process.argv);
