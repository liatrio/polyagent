import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Root project directory
const PROJECT_ROOT = join(process.cwd());

describe('Tutorial Documentation (Story 2.4)', () => {
  describe('AC-2.4.1: debug-why-deny.md tutorial exists', () => {
    const tutorialPath = join(PROJECT_ROOT, 'examples/debug-why-deny.md');

    it('should exist at examples/debug-why-deny.md', () => {
      expect(existsSync(tutorialPath)).toBe(true);
    });
  });

  describe('AC-2.4.2: Tutorial includes sample .rego file with RBAC policy', () => {
    const tutorialPath = join(PROJECT_ROOT, 'examples/debug-why-deny.md');

    it('should reference or include RBAC policy content', () => {
      if (!existsSync(tutorialPath)) {
        throw new Error('Tutorial file must exist for this test');
      }

      const content = readFileSync(tutorialPath, 'utf-8');

      // Should contain rego code block or reference to rego file
      expect(content).toMatch(/```rego|rbac.*\.rego|\.rego/i);
    });

    it('should mention RBAC concepts', () => {
      if (!existsSync(tutorialPath)) {
        throw new Error('Tutorial file must exist for this test');
      }

      const content = readFileSync(tutorialPath, 'utf-8').toLowerCase();
      expect(content).toMatch(/role|rbac/i);
    });
  });

  describe('AC-2.4.3: Tutorial includes sample input JSON that gets denied', () => {
    const tutorialPath = join(PROJECT_ROOT, 'examples/debug-why-deny.md');

    it('should include JSON input example', () => {
      if (!existsSync(tutorialPath)) {
        throw new Error('Tutorial file must exist for this test');
      }

      const content = readFileSync(tutorialPath, 'utf-8');

      // Should contain JSON code block
      expect(content).toMatch(/```json/i);
    });

    it('should show an input that would be denied', () => {
      if (!existsSync(tutorialPath)) {
        throw new Error('Tutorial file must exist for this test');
      }

      const content = readFileSync(tutorialPath, 'utf-8').toLowerCase();

      // Should discuss denial scenario
      expect(content).toMatch(/denied|deny|false|not allowed/i);
    });
  });

  describe('AC-2.4.4: Tutorial shows how to ask AI "Why did this deny?"', () => {
    const tutorialPath = join(PROJECT_ROOT, 'examples/debug-why-deny.md');

    it('should include example prompt or question', () => {
      if (!existsSync(tutorialPath)) {
        throw new Error('Tutorial file must exist for this test');
      }

      const content = readFileSync(tutorialPath, 'utf-8').toLowerCase();

      // Should contain example of asking the AI
      expect(content).toMatch(/why.*deny|explain.*policy|what.*happened/i);
    });
  });

  describe('AC-2.4.5: Tutorial shows expected AI response explaining which rule fired', () => {
    const tutorialPath = join(PROJECT_ROOT, 'examples/debug-why-deny.md');

    it('should include example response or trace output', () => {
      if (!existsSync(tutorialPath)) {
        throw new Error('Tutorial file must exist for this test');
      }

      const content = readFileSync(tutorialPath, 'utf-8').toLowerCase();

      // Should show trace or explain what rules evaluated
      expect(content).toMatch(/trace|rule.*evaluated|result|explain_policy_decision/i);
    });

    it('should explain the allow/deny decision', () => {
      if (!existsSync(tutorialPath)) {
        throw new Error('Tutorial file must exist for this test');
      }

      const content = readFileSync(tutorialPath, 'utf-8').toLowerCase();

      // Should explain why access was denied
      expect(content).toMatch(/because|since|reason|default.*deny|no.*rule.*matched/i);
    });
  });
});
