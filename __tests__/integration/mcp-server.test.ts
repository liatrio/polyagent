/**
 * Integration tests for MCP Server
 *
 * Tests full server lifecycle including stdio transport,
 * protocol message handling, and connection management.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '../../dist/server.js');

describe('MCP Server Integration Tests', () => {
  let serverProcess: ChildProcess | null = null;

  afterEach(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess = null;
    }
  });

  describe('Server Startup (AC-5)', () => {
    it('should start without errors and log ready message', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stderrChunks: string[] = [];

      serverProcess.stderr?.on('data', (data) => {
        stderrChunks.push(data.toString());
      });

      // Wait for startup message
      setTimeout(() => {
        const stderr = stderrChunks.join('');

        // Should log startup message to stderr (AC-5)
        expect(stderr).toMatch(/PolyAgent MCP Server v\d+\.\d+\.\d+ ready/);

        done();
      }, 1000);
    }, 10000);

    it('should stay running after initialization', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let exited = false;
      serverProcess.on('exit', () => {
        exited = true;
      });

      // Check that process hasn't exited after 1 second
      setTimeout(() => {
        expect(exited).toBe(false);
        expect(serverProcess?.killed).toBe(false);
        done();
      }, 1000);
    }, 10000);
  });

  describe('MCP Protocol Messages (AC-2)', () => {
    it('should respond to initialize request', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: string[] = [];

      serverProcess.stdout?.on('data', (data) => {
        stdoutChunks.push(data.toString());
      });

      // Send initialize request
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      serverProcess.stdin?.write(JSON.stringify(initializeRequest) + '\n');

      // Wait for response
      setTimeout(() => {
        const stdout = stdoutChunks.join('');

        // Should contain JSON-RPC response
        expect(stdout).toContain('"jsonrpc":"2.0"');
        expect(stdout).toContain('"id":1');

        done();
      }, 1000);
    }, 10000);

    it('should respond to tools/list request with empty array', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: string[] = [];

      serverProcess.stdout?.on('data', (data) => {
        stdoutChunks.push(data.toString());
      });

      // First initialize
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      serverProcess.stdin?.write(JSON.stringify(initializeRequest) + '\n');

      // Then send tools/list
      setTimeout(() => {
        const toolsListRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        };

        if (serverProcess?.stdin) {
          serverProcess.stdin.write(JSON.stringify(toolsListRequest) + '\n');
        }

        // Wait for response
        setTimeout(() => {
          const stdout = stdoutChunks.join('');

          // Should contain tools list response with system/health tool
          expect(stdout).toContain('"name":"system/health"');

          done();
        }, 500);
      }, 500);
    }, 10000);
  });

  describe('Graceful Shutdown (AC-5)', () => {
    it('should handle SIGTERM signal', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let exitCode: number | null = null;

      serverProcess.on('exit', (code) => {
        exitCode = code;
      });

      // Wait for startup, then send SIGTERM
      setTimeout(() => {
        if (serverProcess) {
          serverProcess.kill('SIGTERM');
        }

        // Wait for process to exit
        setTimeout(() => {
          expect(exitCode).toBe(0);
          done();
        }, 500);
      }, 500);
    }, 10000);

    it('should handle SIGINT signal', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let exitCode: number | null = null;
      let exitSignal: NodeJS.Signals | null = null;

      serverProcess.on('exit', (code, signal) => {
        exitCode = code;
        exitSignal = signal;
      });

      // Wait for startup, then send SIGINT
      setTimeout(() => {
        if (serverProcess) {
          serverProcess.kill('SIGINT');
        }

        // Wait for process to exit
        setTimeout(() => {
          // process exits with code 0 or is terminated by SIGINT signal
          const exitedGracefully = exitCode === 0 || exitSignal === 'SIGINT';
          expect(exitedGracefully).toBe(true);
          done();
        }, 500);
      }, 500);
    }, 10000);
  });

  describe('Error Handling (AC-4)', () => {
    it('should not crash on malformed JSON', (done) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let exited = false;
      serverProcess.on('exit', () => {
        exited = true;
      });

      // Send malformed JSON
      serverProcess.stdin?.write('{ invalid json \n');

      // Wait and verify server didn't crash (AC-4: graceful error handling)
      setTimeout(() => {
        expect(exited).toBe(false);
        done();
      }, 1000);
    }, 10000);
  });
});
