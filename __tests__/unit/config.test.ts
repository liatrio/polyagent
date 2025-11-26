import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigService } from '../../src/config/index.js';

// Mock fs/promises
// Note: In ESM with Jest, mocking modules requires unstable_mockModule or import mocking.
// For simplicity in this environment, we'll rely on the fact that ConfigService accepts a path.
// We will point to non-existent files for defaults, and we'll need a strategy for existing files.
// Actually, since we are in a VM environment, let's try to use a temporary file or just mock the internal method if possible.
// But we can't mock private methods easily in TS.

// Better approach for Unit Test:
// Since we can't easily mock fs/promises in ESM Jest without top-level await/unstable APIs,
// let's assume we can test the VALIDATION logic by passing a path to a real file we write,
// or just rely on "file not found" behavior for defaults.

// For the "file exists" case, we can write a real temp file in the test.

import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigService Unit Tests', () => {
  let configService: ConfigService;
  const tempConfigPath = join(tmpdir(), `polyagent-test-config-${Date.now()}.json`);

  beforeEach(() => {
    // Reset singleton (we added a reset method for this purpose)
    configService = ConfigService.getInstance();
    configService.reset();
  });

  afterEach(async () => {
    try {
      await unlink(tempConfigPath);
    } catch {}
  });

  describe('Default Configuration (AC-2)', () => {
    it('should load default values when no config file exists', async () => {
      const config = await configService.initialize('/non/existent/path/config.json');
      
      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('localhost');
      expect(config.server.logLevel).toBe('info');
      expect(config.git.ignoredPaths).toContain('node_modules');
      expect(config.security.sandbox).toBe(true);
    });
  });

  describe('User Configuration Merging (AC-3)', () => {
    it('should merge user configuration with defaults', async () => {
      const userConfig = {
        server: {
          port: 8080,
        },
        security: {
          trustedCommands: ['ls'],
        },
      };
      
      await writeFile(tempConfigPath, JSON.stringify(userConfig));
      
      const config = await configService.initialize(tempConfigPath);
      
      // Overridden values
      expect(config.server.port).toBe(8080);
      expect(config.security.trustedCommands).toContain('ls');
      
      // Default preserved values
      expect(config.server.host).toBe('localhost'); // Default
      expect(config.server.logLevel).toBe('info');  // Default
      expect(config.security.sandbox).toBe(true);   // Default
    });

    it('should replace arrays instead of merging them (Zod behavior)', async () => {
      const userConfig = {
        git: {
          ignoredPaths: ['.env'],
        },
      };
      
      await writeFile(tempConfigPath, JSON.stringify(userConfig));
      
      const config = await configService.initialize(tempConfigPath);
      
      expect(config.git.ignoredPaths).toHaveLength(1);
      expect(config.git.ignoredPaths).toContain('.env');
      expect(config.git.ignoredPaths).not.toContain('node_modules');
    });
  });

  describe('Validation (AC-4)', () => {
    it('should throw error for invalid configuration types', async () => {
      const invalidConfig = {
        server: {
          port: "not-a-number", // Should be number
        },
      };
      
      await writeFile(tempConfigPath, JSON.stringify(invalidConfig));
      
      await expect(configService.initialize(tempConfigPath))
        .rejects
        .toThrow();
    });

    it('should throw error for invalid enum values', async () => {
      const invalidConfig = {
        server: {
          logLevel: "loud", // Invalid enum
        },
      };
      
      await writeFile(tempConfigPath, JSON.stringify(invalidConfig));
      
      await expect(configService.initialize(tempConfigPath))
        .rejects
        .toThrow();
    });
  });
});
