import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OpaEvaluator } from '../../src/lib/opa-evaluator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_PATH = join(__dirname, '../../examples/policies');

describe('OpaEvaluator', () => {
  beforeEach(() => {
    OpaEvaluator.clearCache();
  });

  afterEach(() => {
    OpaEvaluator.dispose();
  });

  describe('loadPolicy', () => {
    it('should load a valid rego policy file', async () => {
      const policyPath = join(FIXTURES_PATH, 'simple-allow.rego');
      await expect(OpaEvaluator.loadPolicy({ policyPath })).resolves.not.toThrow();
    });

    it('should throw FILE_NOT_FOUND for non-existent file', async () => {
      const policyPath = join(FIXTURES_PATH, 'does-not-exist.rego');
      await expect(OpaEvaluator.loadPolicy({ policyPath })).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
      });
    });
  });

  describe('evaluate', () => {
    it('should evaluate a simple policy and return true for admin', async () => {
      const policyPath = join(FIXTURES_PATH, 'simple-allow.rego');
      await OpaEvaluator.loadPolicy({ policyPath });

      const result = await OpaEvaluator.evaluate({
        input: { user: { role: 'admin' } },
        packageName: 'authz',
        ruleName: 'allow',
      });

      expect(result.allowed).toBe(true);
      expect(result.packageName).toBe('authz');
      expect(result.ruleName).toBe('allow');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should evaluate a simple policy and return false for non-admin', async () => {
      const policyPath = join(FIXTURES_PATH, 'simple-allow.rego');
      await OpaEvaluator.loadPolicy({ policyPath });

      const result = await OpaEvaluator.evaluate({
        input: { user: { role: 'guest' } },
        packageName: 'authz',
        ruleName: 'allow',
      });

      expect(result.allowed).toBe(false);
    });

    it('should evaluate policy with different package name', async () => {
      const policyPath = join(FIXTURES_PATH, 'v0-syntax.rego');
      await OpaEvaluator.loadPolicy({ policyPath });

      const result = await OpaEvaluator.evaluate({
        input: { user: { role: 'admin' } },
        packageName: 'authz_alt',
        ruleName: 'allow',
      });

      expect(result.allowed).toBe(true);
    });

    it('should return execution time under 2 seconds', async () => {
      const policyPath = join(FIXTURES_PATH, 'simple-allow.rego');
      await OpaEvaluator.loadPolicy({ policyPath });

      const result = await OpaEvaluator.evaluate({
        input: { user: { role: 'admin' } },
        packageName: 'authz',
        ruleName: 'allow',
      });

      expect(result.executionTimeMs).toBeLessThan(2000);
    });
  });

  describe('error handling', () => {
    it('should return syntax error with line number for invalid policy', async () => {
      const policyPath = join(FIXTURES_PATH, 'invalid-syntax.rego');
      
      try {
        await OpaEvaluator.loadPolicy({ policyPath });
        fail('Expected SYNTAX_ERROR to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('SYNTAX_ERROR');
        expect(error.message).toContain('syntax');
        // AC-2.1.7: verify line number is extracted (may be undefined if OPA doesn't provide it)
        expect(error).toHaveProperty('line');
      }
    });

    it('should suggest valid package names for invalid package', async () => {
      const policyPath = join(FIXTURES_PATH, 'simple-allow.rego');
      await OpaEvaluator.loadPolicy({ policyPath });

      await expect(
        OpaEvaluator.evaluate({
          input: {},
          packageName: 'invalid_pkg',
          ruleName: 'allow',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PACKAGE',
        suggestions: expect.arrayContaining([expect.stringContaining('authz')]),
      });
    });
  });

  describe('WASM instance management', () => {
    it('should reuse WASM instance for same policy', async () => {
      const policyPath = join(FIXTURES_PATH, 'simple-allow.rego');
      
      await OpaEvaluator.loadPolicy({ policyPath });
      const cacheSize1 = OpaEvaluator.getCacheSize();
      
      await OpaEvaluator.loadPolicy({ policyPath });
      const cacheSize2 = OpaEvaluator.getCacheSize();

      expect(cacheSize1).toBe(cacheSize2);
      expect(cacheSize1).toBe(1);
    });

    it('should clear cache and dispose instances', async () => {
      const policyPath = join(FIXTURES_PATH, 'simple-allow.rego');
      await OpaEvaluator.loadPolicy({ policyPath });
      
      expect(OpaEvaluator.getCacheSize()).toBe(1);
      
      OpaEvaluator.clearCache();
      
      expect(OpaEvaluator.getCacheSize()).toBe(0);
    });

    it('should track memory usage of loaded policies', async () => {
      const policyPath = join(FIXTURES_PATH, 'simple-allow.rego');
      
      expect(OpaEvaluator.getTotalMemoryUsage()).toBe(0);
      
      await OpaEvaluator.loadPolicy({ policyPath });
      
      // memory should be tracked after loading
      const memoryUsage = OpaEvaluator.getTotalMemoryUsage();
      expect(memoryUsage).toBeGreaterThan(0);
      // AC-2.1.9: should be under 50MB
      expect(memoryUsage).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('path security', () => {
    it('should reject path traversal attempts', async () => {
      const policyPath = join(FIXTURES_PATH, '../../../etc/passwd');
      
      await expect(
        OpaEvaluator.loadPolicy({ policyPath, basePath: FIXTURES_PATH })
      ).rejects.toMatchObject({
        code: 'PATH_SECURITY_ERROR',
      });
    });
  });
});
