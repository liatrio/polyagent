import chalk from 'chalk';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ConfigService } from '../config/index.js';
import { FrameworkStore } from '../services/framework-store.js';
import { LoggerService } from '../services/logger.js';
import { OpaEvaluator } from '../lib/opa-evaluator.js';
import { VectorStore } from '../lib/vector-store.js';
import { EmbeddingService } from '../lib/embedding-service.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Find project root by looking for package.json
function findProjectRoot(): string {
  // In ESM, use import.meta.url to get current file location
  const currentFile = fileURLToPath(import.meta.url);
  let dir = dirname(currentFile);

  // Walk up to find package.json (indicates project root)
  while (dir !== '/') {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return process.cwd();
}

export async function runVerify(): Promise<void> {
  console.log(chalk.blue('PolyAgent Verification'));
  
  let success = true;

  // 1. Verify Config
  try {
    process.stdout.write('Checking configuration... ');
    await ConfigService.getInstance().initialize();
    console.log(chalk.green('OK'));
  } catch (err) {
    console.log(chalk.red('FAILED'));
    console.error(err);
    success = false;
  }

  // 2. Verify Frameworks (Internal check)
  try {
    process.stdout.write('Checking framework data... ');
    // Initialize logger for FrameworkStore (it uses LoggerService.getLogger())
    LoggerService.initialize(); 
    await FrameworkStore.getInstance().initialize();
    const frameworks = FrameworkStore.getInstance().listFrameworks();
    if (frameworks.length >= 3) {
      console.log(chalk.green(`OK (${frameworks.length} frameworks loaded)`));
    } else {
      console.log(chalk.red(`FAILED (Only ${frameworks.length} frameworks loaded)`));
      success = false;
    }
  } catch (err) {
    console.log(chalk.red('FAILED'));
    console.error(err);
    success = false;
  }

  // 3. Verify MCP Server Connection
  process.stdout.write('Testing MCP server connection... ');
  
  // Determine the script to run. We use the current process's entry point.
  const scriptPath = process.argv[1]; 
  
  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [scriptPath, 'start']
    });

    const client = new Client(
      {
        name: 'polyagent-verify-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    
    // Check tools list
    const tools = await client.listTools();
    
    // Should have at least system/health
    if (tools.tools.some(t => t.name === 'system/health')) {
         console.log(chalk.green('OK'));
    } else {
        console.log(chalk.yellow('WARNING (Connected but system/health tool missing)'));
    }

    await client.close();
  } catch (err) {
    console.log(chalk.red('FAILED'));
    // Only log full error if it's not just a connection close
    // console.error('Could not connect to MCP server:', err);
    // Simplified error for CLI user
    console.log(chalk.red(`\nCould not connect to MCP server at ${scriptPath}`));
    success = false;
  }
  
  // 4. OPA Engine verification using example policy
  process.stdout.write('Checking OPA engine... ');
  try {
    const projectRoot = findProjectRoot();
    const examplePolicyPath = join(projectRoot, 'examples/policies/rbac-simple.rego');

    if (!existsSync(examplePolicyPath)) {
      console.log(chalk.yellow('SKIPPED (Example policy not found)'));
    } else {
      // Load and evaluate the example policy
      await OpaEvaluator.loadPolicy({ policyPath: examplePolicyPath });

      // Test with admin user (should allow)
      const adminResult = await OpaEvaluator.evaluate({
        input: {
          user: { name: 'admin', role: 'admin' },
          action: 'write',
          resource: { type: 'document' }
        },
        packageName: 'rbac',
        ruleName: 'allow'
      });

      // Test with viewer user writing (should deny)
      const viewerResult = await OpaEvaluator.evaluate({
        input: {
          user: { name: 'viewer', role: 'viewer' },
          action: 'write',
          resource: { type: 'document' }
        },
        packageName: 'rbac',
        ruleName: 'allow'
      });

      // Verify expected results
      if (adminResult.allowed === true && viewerResult.allowed === false) {
        console.log(chalk.green('OK (Policy evaluation working)'));
      } else {
        console.log(chalk.red('FAILED (Unexpected policy results)'));
        success = false;
      }

      OpaEvaluator.clearCache();
    }
  } catch (err) {
    console.log(chalk.red('FAILED'));
    console.error('OPA verification error:', err);
    success = false;
  }

  // 5. RAG System verification
  process.stdout.write('Checking RAG system... ');
  try {
    const vectorStore = VectorStore.getInstance();
    const stats = vectorStore.getStats();

    if (!stats.initialized || stats.count === 0) {
      console.log(chalk.yellow('SKIPPED (Policy index not initialized - run setup first)'));
    } else {
      const embeddingService = EmbeddingService.getInstance();
      
      if (!embeddingService.hasApiKey()) {
        console.log(chalk.yellow(`SKIPPED (No OpenAI API key - ${stats.count} policies indexed)`));
      } else {
        // test search with a common query
        const testQuery = 'RBAC authorization policy';
        const queryEmbedding = await embeddingService.generateEmbedding(testQuery);
        const results = vectorStore.search(queryEmbedding, { limit: 1 });
        
        if (results.length > 0) {
          console.log(chalk.green(`OK (${stats.count} policies indexed, search working)`));
        } else {
          console.log(chalk.yellow(`OK (${stats.count} policies indexed, no results for test query)`));
        }
      }
    }
  } catch (err) {
    console.log(chalk.red('FAILED'));
    console.error('RAG verification error:', err);
    success = false;
  }

  if (success) {
    console.log(chalk.green('\n✓ Verification passed successfully.'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n✗ Verification failed. See errors above.'));
    process.exit(1);
  }
}
