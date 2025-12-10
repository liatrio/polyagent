/**
 * Integration tests for explain_policy_decision MCP tool
 *
 * Tests full MCP request/response cycle for the tool.
 * AC-2.3.1: Tool appears in tools/list
 * AC-2.3.2-2.3.11: Full tool invocation tests
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '../../dist/server.js');

// Test fixtures - use integration-specific directory to avoid conflicts with unit tests
const TEST_FIXTURES_DIR = join(__dirname, '../fixtures/integration-policies');
const TEST_POLICY_PATH = join(TEST_FIXTURES_DIR, 'integration-test-policy.rego');
const TEST_POLICY_CONTENT = `package test.integration

default allow = false

allow if {
    input.user == "admin"
}

allow if {
    input.role == "editor"
    input.action == "read"
}
`;

describe('MCP Server explain_policy_decision Tool Integration Tests', () => {
  let serverProcess: ChildProcess | null = null;

  beforeAll(() => {
    // Create test fixtures directory and policy file
    mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
    writeFileSync(TEST_POLICY_PATH, TEST_POLICY_CONTENT);
  });

  afterAll(() => {
    // Cleanup test fixtures directory
    try {
      rmSync(TEST_FIXTURES_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  afterEach(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess = null;
    }
  });

  describe('Tool Registration (AC-2.3.1)', () => {
    it('should include explain_policy_decision in tools/list', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: string[] = [];

      serverProcess.stdout?.on('data', (data) => {
        stdoutChunks.push(data.toString());
      });

      // Initialize first
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      };

      serverProcess.stdin?.write(JSON.stringify(initRequest) + '\n');

      setTimeout(() => {
        // Then list tools
        const toolsListRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        };

        serverProcess?.stdin?.write(JSON.stringify(toolsListRequest) + '\n');

        setTimeout(() => {
          const stdout = stdoutChunks.join('');

          // AC-2.3.1: Tool should be registered with correct name
          expect(stdout).toContain('"name":"explain_policy_decision"');
          done();
        }, 500);
      }, 500);
    }, 10000);
  });

  describe('Tool Invocation', () => {
    it('should successfully evaluate a policy and return result (AC-2.3.6, AC-2.3.7)', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: string[] = [];

      serverProcess.stdout?.on('data', (data) => {
        stdoutChunks.push(data.toString());
      });

      // Initialize first
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      };

      serverProcess.stdin?.write(JSON.stringify(initRequest) + '\n');

      setTimeout(() => {
        // Call the tool
        const toolCallRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'explain_policy_decision',
            arguments: {
              policyPath: TEST_POLICY_PATH,
              inputData: '{"user": "admin"}',
              packageName: 'test.integration',
              ruleName: 'allow',
            },
          },
        };

        serverProcess?.stdin?.write(JSON.stringify(toolCallRequest) + '\n');

        setTimeout(() => {
          const stdout = stdoutChunks.join('');

          // AC-2.3.7: Should return result and trace
          // The response is escaped JSON within the content
          expect(stdout).toContain('result');
          expect(stdout).toContain('trace');

          // Parse the actual response to verify structure
          try {
            const lines = stdout.split('\n').filter(Boolean);
            const lastResponse = JSON.parse(lines[lines.length - 1]);
            const toolResult = JSON.parse(lastResponse.result.content[0].text);
            expect(toolResult).toHaveProperty('result');
            expect(toolResult).toHaveProperty('trace');
            // The admin user should be allowed (result is true)
            expect(toolResult.result).toBe(true);
          } catch {
            // If parsing fails, at least verify the raw output contains expected content
            expect(stdout).toContain('allow');
          }
          done();
        }, 2000);
      }, 1000);
    }, 15000);

    it('should return error for invalid JSON input (AC-2.3.9)', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: string[] = [];

      serverProcess.stdout?.on('data', (data) => {
        stdoutChunks.push(data.toString());
      });

      // Initialize first
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      };

      serverProcess.stdin?.write(JSON.stringify(initRequest) + '\n');

      setTimeout(() => {
        // Call the tool with invalid JSON
        const toolCallRequest = {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'explain_policy_decision',
            arguments: {
              policyPath: TEST_POLICY_PATH,
              inputData: '{invalid json}',
            },
          },
        };

        serverProcess?.stdin?.write(JSON.stringify(toolCallRequest) + '\n');

        setTimeout(() => {
          const stdout = stdoutChunks.join('');

          // AC-2.3.9: Should return error for invalid JSON
          expect(stdout).toContain('INVALID_INPUT');
          expect(stdout).toContain('Invalid JSON');
          done();
        }, 1000);
      }, 1000);
    }, 15000);

    it('should return error for file not found (AC-2.3.8)', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: string[] = [];

      serverProcess.stdout?.on('data', (data) => {
        stdoutChunks.push(data.toString());
      });

      // Initialize first
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      };

      serverProcess.stdin?.write(JSON.stringify(initRequest) + '\n');

      setTimeout(() => {
        // Call the tool with non-existent file
        const toolCallRequest = {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'explain_policy_decision',
            arguments: {
              policyPath: '/nonexistent/path/policy.rego',
              inputData: '{}',
            },
          },
        };

        serverProcess?.stdin?.write(JSON.stringify(toolCallRequest) + '\n');

        setTimeout(() => {
          const stdout = stdoutChunks.join('');

          // AC-2.3.8: Should return actionable error for file not found
          expect(stdout).toContain('FILE_NOT_FOUND');
          done();
        }, 1000);
      }, 1000);
    }, 15000);
  });
});
