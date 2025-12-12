import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Root project directory
const PROJECT_ROOT = join(process.cwd());

describe('Example Input Files (Story 2.4)', () => {
  describe('examples/inputs directory', () => {
    const inputsDir = join(PROJECT_ROOT, 'examples/inputs');

    it('should have examples/inputs directory', () => {
      expect(existsSync(inputsDir)).toBe(true);
    });
  });

  describe('rbac-denied-request.json', () => {
    const filePath = join(PROJECT_ROOT, 'examples/inputs/rbac-denied-request.json');

    it('should exist', () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it('should be valid JSON', () => {
      if (!existsSync(filePath)) {
        throw new Error('File must exist for this test');
      }

      const content = readFileSync(filePath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should contain user, action, and resource fields', () => {
      if (!existsSync(filePath)) {
        throw new Error('File must exist for this test');
      }

      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content).toHaveProperty('user');
      expect(content).toHaveProperty('action');
      expect(content).toHaveProperty('resource');
    });
  });

  describe('rbac-allowed-request.json', () => {
    const filePath = join(PROJECT_ROOT, 'examples/inputs/rbac-allowed-request.json');

    it('should exist', () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it('should be valid JSON', () => {
      if (!existsSync(filePath)) {
        throw new Error('File must exist for this test');
      }

      const content = readFileSync(filePath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should contain user, action, and resource fields', () => {
      if (!existsSync(filePath)) {
        throw new Error('File must exist for this test');
      }

      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content).toHaveProperty('user');
      expect(content).toHaveProperty('action');
      expect(content).toHaveProperty('resource');
    });
  });
});
