import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Root project directory
const PROJECT_ROOT = join(process.cwd());

describe('README Documentation (Story 2.4)', () => {
  const readmePath = join(PROJECT_ROOT, 'README.md');

  beforeAll(() => {
    if (!existsSync(readmePath)) {
      throw new Error('README.md must exist');
    }
  });

  describe('AC-2.4.8: README.md documents explain_policy_decision tool', () => {
    it('should have MCP Tool Reference section', () => {
      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toMatch(/MCP Tool|Tool Reference|Available Tools/i);
    });

    it('should document explain_policy_decision tool', () => {
      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toMatch(/explain_policy_decision/i);
    });

    it('should describe what the tool does', () => {
      const content = readFileSync(readmePath, 'utf-8').toLowerCase();
      expect(content).toMatch(/evaluat.*policy|policy.*evaluat|debug.*policy|trace/i);
    });
  });

  describe('AC-2.4.9: README includes input parameters with examples', () => {
    it('should document policyPath parameter', () => {
      const content = readFileSync(readmePath, 'utf-8').toLowerCase();
      expect(content).toMatch(/policypath|policy.*path/i);
    });

    it('should document inputData parameter', () => {
      const content = readFileSync(readmePath, 'utf-8').toLowerCase();
      expect(content).toMatch(/inputdata|input.*data|input.*json/i);
    });

    it('should include example values', () => {
      const content = readFileSync(readmePath, 'utf-8');
      // Should have code examples or JSON
      expect(content).toMatch(/```|example|\.rego/i);
    });
  });

  describe('AC-2.4.10: README includes output format with sample trace', () => {
    it('should document the output format', () => {
      const content = readFileSync(readmePath, 'utf-8').toLowerCase();
      expect(content).toMatch(/output|response|return/i);
    });

    it('should show trace array in output', () => {
      const content = readFileSync(readmePath, 'utf-8').toLowerCase();
      expect(content).toMatch(/trace|rule.*evaluated/i);
    });

    it('should show result field', () => {
      const content = readFileSync(readmePath, 'utf-8').toLowerCase();
      expect(content).toMatch(/result.*true|result.*false|"result"/i);
    });
  });
});
