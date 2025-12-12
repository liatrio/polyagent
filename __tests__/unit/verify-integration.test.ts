import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Root project directory
const PROJECT_ROOT = join(process.cwd());

describe('Verify Integration (Story 2.4)', () => {
  describe('AC-2.4.11: polyagent-mcp verify uses example policy for testing', () => {
    const verifyPath = join(PROJECT_ROOT, 'src/commands/verify.ts');

    it('should reference example policy path in verify command', () => {
      if (!existsSync(verifyPath)) {
        throw new Error('verify.ts must exist');
      }

      const content = readFileSync(verifyPath, 'utf-8');

      // Should reference the rbac-simple.rego example policy
      expect(content).toMatch(/rbac-simple\.rego|examples\/policies/i);
    });

    it('should import and use OpaEvaluator', () => {
      if (!existsSync(verifyPath)) {
        throw new Error('verify.ts must exist');
      }

      const content = readFileSync(verifyPath, 'utf-8');

      // Should import OpaEvaluator
      expect(content).toMatch(/import.*OpaEvaluator/);
      // Should use OpaEvaluator methods
      expect(content).toMatch(/OpaEvaluator\.loadPolicy/);
      expect(content).toMatch(/OpaEvaluator\.evaluate/);
    });

    it('should test both allow and deny scenarios', () => {
      if (!existsSync(verifyPath)) {
        throw new Error('verify.ts must exist');
      }

      const content = readFileSync(verifyPath, 'utf-8');

      // Should test admin (allow) and viewer (deny) scenarios
      expect(content).toMatch(/admin/i);
      expect(content).toMatch(/viewer/i);
    });
  });
});
