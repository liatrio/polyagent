import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { OpaEvaluator } from '../../src/lib/opa-evaluator';

// Root project directory
const PROJECT_ROOT = join(process.cwd());

describe('Example Policies (Story 2.4)', () => {
  afterEach(() => {
    OpaEvaluator.clearCache();
  });

  describe('AC-2.4.6: rbac-simple.rego exists', () => {
    const policyPath = join(PROJECT_ROOT, 'examples/policies/rbac-simple.rego');

    it('should exist at examples/policies/rbac-simple.rego', () => {
      expect(existsSync(policyPath)).toBe(true);
    });

    it('should be a valid Rego file that can be loaded', async () => {
      if (!existsSync(policyPath)) {
        throw new Error('Policy file must exist for this test');
      }

      await expect(
        OpaEvaluator.loadPolicy({ policyPath })
      ).resolves.not.toThrow();
    });
  });

  describe('AC-2.4.7: Test policy is well-commented for learning', () => {
    const policyPath = join(PROJECT_ROOT, 'examples/policies/rbac-simple.rego');

    it('should contain explanatory comments', () => {
      if (!existsSync(policyPath)) {
        throw new Error('Policy file must exist for this test');
      }

      const content = readFileSync(policyPath, 'utf-8');
      const lines = content.split('\n');
      const commentLines = lines.filter(line => line.trim().startsWith('#'));

      // Should have at least 5 comment lines for good documentation
      expect(commentLines.length).toBeGreaterThanOrEqual(5);
    });

    it('should have comments explaining RBAC concepts', () => {
      if (!existsSync(policyPath)) {
        throw new Error('Policy file must exist for this test');
      }

      const content = readFileSync(policyPath, 'utf-8').toLowerCase();

      // Should mention key RBAC concepts
      expect(content).toMatch(/role/i);
      expect(content).toMatch(/allow|deny|permit/i);
    });

    it('should be less than 50 lines for quick understanding', () => {
      if (!existsSync(policyPath)) {
        throw new Error('Policy file must exist for this test');
      }

      const content = readFileSync(policyPath, 'utf-8');
      const lines = content.split('\n');

      expect(lines.length).toBeLessThanOrEqual(50);
    });
  });

  describe('RBAC Policy Functionality', () => {
    const policyPath = join(PROJECT_ROOT, 'examples/policies/rbac-simple.rego');

    it('should deny access when user lacks required role', async () => {
      if (!existsSync(policyPath)) {
        throw new Error('Policy file must exist for this test');
      }

      await OpaEvaluator.loadPolicy({ policyPath });

      const result = await OpaEvaluator.evaluate({
        input: {
          user: { name: 'alice', role: 'viewer' },
          action: 'write',
          resource: { type: 'document' }
        },
        packageName: 'rbac',
        ruleName: 'allow'
      });

      expect(result.allowed).toBe(false);
    });

    it('should allow access for admin role', async () => {
      if (!existsSync(policyPath)) {
        throw new Error('Policy file must exist for this test');
      }

      await OpaEvaluator.loadPolicy({ policyPath });

      const result = await OpaEvaluator.evaluate({
        input: {
          user: { name: 'admin', role: 'admin' },
          action: 'write',
          resource: { type: 'document' }
        },
        packageName: 'rbac',
        ruleName: 'allow'
      });

      expect(result.allowed).toBe(true);
    });
  });
});
