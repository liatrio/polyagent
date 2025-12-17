import inquirer from 'inquirer';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

export async function runSetup(): Promise<void> {
  console.log(chalk.blue('PolyAgent MCP Server Setup'));
  console.log('This wizard will help you configure PolyAgent for your environment.\n');

  // Detect existing tools
  const hasClaude = existsSync(join(homedir(), '.claude'));
  const hasCursor = existsSync(join(homedir(), '.cursor')) || 
                    existsSync(join(homedir(), 'Library/Application Support/Cursor')) ||
                    existsSync(join(homedir(), '.cursor-tutor')); // Just in case

  if (hasClaude) console.log(chalk.green('✓ Detected Claude Code'));
  if (hasCursor) console.log(chalk.green('✓ Detected Cursor'));
  console.log('');

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'openAiApiKey',
      message: 'Enter OpenAI API Key (for RAG features, optional):',
      mask: '*'
    },
    {
      type: 'checkbox',
      name: 'configureTools',
      message: 'Which tools should be configured automatically?',
      choices: [
        { name: 'Claude Code', value: 'claude', checked: hasClaude },
        { name: 'Cursor (Manual instructions)', value: 'cursor', checked: hasCursor } // Inquirer handles disabled slightly differently depending on version, but we'll just let user select it to get instructions
      ]
    }
  ]);

  // Create config
  const configDir = join(homedir(), '.polyagent');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config = {
    version: '1.0',
    embedding: {
      provider: 'openai',
      apiKey: answers.openAiApiKey || '',
      model: 'text-embedding-3-small'
    },
    policyExamples: {
      repos: [],
      updateInterval: '7d'
    },
    opa: {
      engine: 'wasm'
    },
    logging: {
      level: 'info'
    }
  };

  const configPath = join(configDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(chalk.green(`\n✓ Configuration saved to ${configPath}`));

  // Configure Claude
  if (answers.configureTools.includes('claude')) {
    const claudeConfigPath = join(homedir(), '.claude/mcp_config.json'); 
    
    try {
      let mcpConfig: any = { mcpServers: {} };
      if (existsSync(claudeConfigPath)) {
        try {
          mcpConfig = JSON.parse(readFileSync(claudeConfigPath, 'utf-8'));
        } catch {
          // If file exists but is invalid, start fresh but warn? Or just overwrite?
          // We'll initialize if empty/invalid
          mcpConfig = { mcpServers: {} };
        }
      } else {
          const claudeDir = dirname(claudeConfigPath);
          if(!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
      }

      // Ensure mcpServers object exists
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

      mcpConfig.mcpServers['polyagent'] = {
        command: 'polyagent-mcp',
        args: ['start']
      };

      writeFileSync(claudeConfigPath, JSON.stringify(mcpConfig, null, 2));
      console.log(chalk.green(`✓ Claude Code configuration updated at ${claudeConfigPath}`));
    } catch (err) {
      console.log(chalk.red(`✗ Failed to configure Claude Code: ${err}`));
    }
  }
  
  if (answers.configureTools.includes('cursor')) {
      console.log(chalk.yellow('\nFor Cursor, please add the following to your MCP configuration manually:'));
      console.log(chalk.white(`
{
  "polyagent": {
    "command": "polyagent-mcp",
    "args": ["start"]
  }
}
      `));
  }

  console.log(chalk.blue('\nSetup complete! Run `polyagent-mcp verify` to test your installation.'));
}
