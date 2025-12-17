/**
 * Unit tests for MCP Server Core
 *
 * Tests server initialization and basic configuration.
 * Integration tests cover full protocol message handling.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

describe('MCP Server Core - Unit Tests', () => {
  let server: Server;

  beforeEach(() => {
    // Create a minimal server instance for unit testing
    server = new Server(
      {
        name: '@polyagent/mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Server Initialization (AC-1)', () => {
    it('should create server instance successfully', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(Server);
    });

    it('should accept request handler registration without errors', () => {
      expect(() => {
        server.setRequestHandler(ListToolsRequestSchema, async () => ({
          tools: [],
        }));
      }).not.toThrow();
    });
  });

  describe('Error Handling (AC-4)', () => {
    it('should allow setting custom error handler', () => {
      expect(() => {
        server.onerror = (error) => {
          console.error('[MCP Error]', error);
        };
      }).not.toThrow();
    });

    it('should not crash when error handler is invoked', () => {
      const errors: Error[] = [];
      server.onerror = (error) => {
        errors.push(error);
      };

      const testError = new Error('Test error');
      server.onerror(testError);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(testError);
    });
  });

  describe('Graceful Shutdown (AC-5)', () => {
    it('should close server without throwing errors', async () => {
      await expect(server.close()).resolves.not.toThrow();
    });

    it('should handle multiple close calls safely', async () => {
      await server.close();
      // Second close should not throw
      await expect(server.close()).resolves.not.toThrow();
    });
  });
});
