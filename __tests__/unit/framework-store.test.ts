import { jest } from '@jest/globals';
import { FrameworkStore } from '../../src/services/framework-store';
import { LoggerService } from '../../src/services/logger';
import * as fs from 'fs';
import * as path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Remove mocks
// jest.mock('../../src/services/logger', ...);

import { ConfigService } from '../../src/config/index';

describe('FrameworkStore', () => {
  let frameworkStore: FrameworkStore;
  
  const testDir = path.join(__dirname, 'test-frameworks');

  beforeAll(async () => {
    // Initialize services
    await ConfigService.getInstance().initialize();
    LoggerService.initialize();

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset singleton instance hack (if possible, or just get instance)
    // Since it's a singleton, we can't easily reset it without messing with module cache or adding a reset method.
    // For now, we'll assume we can just use the instance, but we might need to add a reset() method to the class for testing.
    // To properly isolate, we should probably add a reset method to the class in dev.
    // Or just test behavior incrementally.
    
    // Let's use a fresh instance by casting to any and accessing private constructor/properties if needed,
    // or just rely on the fact that we can re-initialize if we add a reset flag.
    // For this test, I'll use the instance but be careful about state.
    frameworkStore = FrameworkStore.getInstance();
    // Use reflection/any to reset private state for testing
    (frameworkStore as any).frameworks.clear();
    (frameworkStore as any).initialized = false;
  });

  it('should initialize and load frameworks', async () => {
    // Mock fs.readdirSync and readFileSync to avoid dependency on real files for unit test
    // But actually, we want to test real loading logic.
    // Let's stick to mocking fs for pure unit test, or use real files.
    // Given we have real files in frameworks/, we can test loading them.
    
    await frameworkStore.initialize();
    
    const frameworks = frameworkStore.listFrameworks();
    expect(frameworks).toContain('openssf-slsa');
    expect(frameworks).toContain('cis-kubernetes');
    expect(frameworks).toContain('nist-800-190');
    expect(frameworkStore.getFrameworksCount()).toBeGreaterThanOrEqual(3);
  });

  it('should return correct requirement', async () => {
    await frameworkStore.initialize();
    const req = frameworkStore.getRequirement('openssf-slsa', 'build-l1');
    expect(req).toBeDefined();
    expect(req.title).toBe('Build Level 1: Provenance Exists');
  });

  it('should throw error for non-existent framework', async () => {
    await frameworkStore.initialize();
    expect(() => {
      frameworkStore.getRequirement('non-existent', 'req-1');
    }).toThrow(/Framework 'non-existent' not found/);
  });

  it('should throw error for non-existent requirement', async () => {
    await frameworkStore.initialize();
    expect(() => {
      frameworkStore.getRequirement('openssf-slsa', 'non-existent-req');
    }).toThrow(/Requirement 'non-existent-req' not found/);
  });

  it('should validate YAML schema', async () => {
    // Test invalid YAML manually
    const invalidYaml = `
framework:
  id: "invalid"
  name: "Invalid"
  # missing version and url
requirements: []
    `;
    const invalidPath = path.join(testDir, 'invalid.yaml');
    fs.writeFileSync(invalidPath, invalidYaml);

    // Spy on loadFrameworksFromDir to inject our test dir
    // or just call the private method if we can expose it.
    // Better: mock fs.readdirSync to return our invalid file when scanning a specific dir.
    
    // Since mocking fs globally for just one test is tricky with jest.mock hoisting,
    // we might rely on integration tests for file loading or refactor FrameworkStore to take a path.
    // But wait, initialize() determines paths. 
    
    // Let's just verify the Zod schema directly for this unit test.
    const { FrameworkFileSchema } = await import('../../src/services/framework-store');
    
    const validData = {
      framework: {
        id: 'valid',
        name: 'Valid',
        version: '1.0',
        url: 'http://example.com'
      },
      requirements: []
    };
    
    const invalidData = {
      framework: {
        id: 'invalid',
        name: 'Invalid'
        // missing version
      },
      requirements: []
    };

    expect(FrameworkFileSchema.safeParse(validData).success).toBe(true);
    expect(FrameworkFileSchema.safeParse(invalidData).success).toBe(false);
  });
});
