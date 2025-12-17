import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { z } from 'zod';

// mock services before importing the module
jest.unstable_mockModule('../../src/lib/vector-store.js', () => ({
  VectorStore: {
    getInstance: jest.fn(),
    resetInstance: jest.fn(),
  },
}));

jest.unstable_mockModule('../../src/lib/embedding-service.js', () => ({
  EmbeddingService: {
    getInstance: jest.fn(),
    resetInstance: jest.fn(),
  },
}));

jest.unstable_mockModule('../../src/services/logger.js', () => ({
  LoggerService: {
    getLogger: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

describe('SearchExamplesToolSchema', () => {
  let SearchExamplesToolSchema: typeof import('../../src/tools/search-examples.js').SearchExamplesToolSchema;
  let executeSearchExamples: typeof import('../../src/tools/search-examples.js').executeSearchExamples;
  let mockVectorStore: { getInstance: jest.Mock };
  let mockEmbeddingService: { getInstance: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    const vectorStoreModule = await import('../../src/lib/vector-store.js');
    const embeddingServiceModule = await import('../../src/lib/embedding-service.js');
    const searchExamplesModule = await import('../../src/tools/search-examples.js');

    mockVectorStore = vectorStoreModule.VectorStore as unknown as { getInstance: jest.Mock };
    mockEmbeddingService = embeddingServiceModule.EmbeddingService as unknown as {
      getInstance: jest.Mock;
    };
    SearchExamplesToolSchema = searchExamplesModule.SearchExamplesToolSchema;
    executeSearchExamples = searchExamplesModule.executeSearchExamples;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Tool Schema (AC-3.4.1, AC-3.4.2)', () => {
    it('should have correct tool name', () => {
      // AC-3.4.1: Tool registered with name search_policy_examples
      expect(SearchExamplesToolSchema.name).toBe('search_policy_examples');
    });

    it('should have a description', () => {
      expect(SearchExamplesToolSchema.description).toBeDefined();
      expect(SearchExamplesToolSchema.description.length).toBeGreaterThan(0);
    });

    it('should accept query as required parameter', () => {
      // AC-3.4.2: query is required
      const validInput = { query: 'kubernetes rbac policy' };
      const result = SearchExamplesToolSchema.input.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject missing query', () => {
      // AC-3.4.2: query is required
      const invalidInput = {};
      const result = SearchExamplesToolSchema.input.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty query', () => {
      const invalidInput = { query: '' };
      const result = SearchExamplesToolSchema.input.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept limit as optional with default 3', () => {
      // AC-3.4.2: limit optional, default 3
      const input = { query: 'test' };
      const result = SearchExamplesToolSchema.input.parse(input);
      expect(result.limit).toBe(3); // zod applies default during parse
    });

    it('should accept limit between 1 and 10', () => {
      // AC-3.4.2: limit max 10
      const validInput = { query: 'test', limit: 5 };
      const result = SearchExamplesToolSchema.input.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject limit greater than 10', () => {
      // AC-3.4.2: limit max 10
      const invalidInput = { query: 'test', limit: 11 };
      const result = SearchExamplesToolSchema.input.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject limit less than 1', () => {
      const invalidInput = { query: 'test', limit: 0 };
      const result = SearchExamplesToolSchema.input.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept filterRepo as optional', () => {
      // AC-3.4.2: filterRepo optional
      const input = { query: 'test', filterRepo: 'liatrio' };
      const result = SearchExamplesToolSchema.input.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Snippet Truncation (AC-3.4.5)', () => {
    it('should truncate snippets longer than 200 lines', async () => {
      // AC-3.4.5: Snippets truncated to 200 lines max
      const longContent = Array(300).fill('# line of policy code').join('\n');

      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
        search: () => [
          {
            entry: {
              id: 'test-1',
              repo: 'test-repo',
              path: 'policy.rego',
              packageName: 'test',
              description: 'Test policy',
              tags: ['test'],
              content: longContent,
              lastUpdated: new Date().toISOString(),
            },
            similarityScore: 0.9,
          },
        ],
      };

      const mockEmbedding = {
        hasApiKey: () => true,
        generateEmbedding: async () => new Float32Array(1536),
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      const result = await executeSearchExamples({ query: 'test policy' });

      expect(result.results).toHaveLength(1);
      const snippetLines = result.results[0].snippet.split('\n');
      // 200 lines + 1 truncation indicator
      expect(snippetLines.length).toBeLessThanOrEqual(201);
      expect(result.results[0].snippet).toContain('[truncated]');
    });

    it('should not truncate snippets with 200 or fewer lines', async () => {
      const shortContent = Array(50).fill('# line of policy code').join('\n');

      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
        search: () => [
          {
            entry: {
              id: 'test-1',
              repo: 'test-repo',
              path: 'policy.rego',
              packageName: 'test',
              description: 'Test policy',
              tags: ['test'],
              content: shortContent,
              lastUpdated: new Date().toISOString(),
            },
            similarityScore: 0.9,
          },
        ],
      };

      const mockEmbedding = {
        hasApiKey: () => true,
        generateEmbedding: async () => new Float32Array(1536),
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      const result = await executeSearchExamples({ query: 'test policy' });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].snippet).not.toContain('[truncated]');
      expect(result.results[0].snippet).toBe(shortContent);
    });
  });

  describe('Empty Results (AC-3.4.6)', () => {
    it('should return suggestions when no results found', async () => {
      // AC-3.4.6: Empty results include suggested alternative queries
      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
        search: () => [],
      };

      const mockEmbedding = {
        hasApiKey: () => true,
        generateEmbedding: async () => new Float32Array(1536),
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      const result = await executeSearchExamples({ query: 'kubernetes policy' });

      expect(result.results).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    it('should provide domain-specific suggestions', async () => {
      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
        search: () => [],
      };

      const mockEmbedding = {
        hasApiKey: () => true,
        generateEmbedding: async () => new Float32Array(1536),
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      const result = await executeSearchExamples({ query: 'rbac authorization' });

      expect(result.suggestions).toBeDefined();
      // should suggest alternatives for rbac
      const suggestionsText = result.suggestions!.join(' ').toLowerCase();
      expect(
        suggestionsText.includes('access') ||
          suggestionsText.includes('permission') ||
          suggestionsText.includes('authorization')
      ).toBe(true);
    });
  });

  describe('Result Formatting (AC-3.4.4)', () => {
    it('should return results with all required fields', async () => {
      // AC-3.4.4: Returns repo, path, snippet, description, tags, similarityScore
      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
        search: () => [
          {
            entry: {
              id: 'test-1',
              repo: 'liatrio',
              path: 'policies/rbac.rego',
              packageName: 'rbac',
              description: 'RBAC policy for Kubernetes',
              tags: ['kubernetes', 'rbac', 'security'],
              content: 'package rbac\n\ndefault allow = false',
              lastUpdated: new Date().toISOString(),
            },
            similarityScore: 0.85,
          },
        ],
      };

      const mockEmbedding = {
        hasApiKey: () => true,
        generateEmbedding: async () => new Float32Array(1536),
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      const result = await executeSearchExamples({ query: 'rbac policy' });

      expect(result.results).toHaveLength(1);
      const policyResult = result.results[0];

      // verify all required fields are present
      expect(policyResult.repo).toBe('liatrio');
      expect(policyResult.path).toBe('policies/rbac.rego');
      expect(policyResult.snippet).toBeDefined();
      expect(policyResult.description).toBe('RBAC policy for Kubernetes');
      expect(policyResult.tags).toEqual(['kubernetes', 'rbac', 'security']);
      expect(policyResult.similarityScore).toBeDefined();
      expect(typeof policyResult.similarityScore).toBe('number');
    });

    it('should round similarity score to 3 decimal places', async () => {
      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
        search: () => [
          {
            entry: {
              id: 'test-1',
              repo: 'test',
              path: 'test.rego',
              packageName: 'test',
              description: 'Test',
              tags: [],
              content: 'package test',
              lastUpdated: new Date().toISOString(),
            },
            similarityScore: 0.856789,
          },
        ],
      };

      const mockEmbedding = {
        hasApiKey: () => true,
        generateEmbedding: async () => new Float32Array(1536),
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      const result = await executeSearchExamples({ query: 'test' });

      expect(result.results[0].similarityScore).toBe(0.857);
    });
  });

  describe('Filter Repository (AC-3.4.7)', () => {
    it('should pass filterRepo to VectorStore search', async () => {
      // AC-3.4.7: filterRepo filters to specific repository
      const searchMock = jest.fn().mockReturnValue([]);

      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
        search: searchMock,
      };

      const mockEmbedding = {
        hasApiKey: () => true,
        generateEmbedding: async () => new Float32Array(1536),
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      await executeSearchExamples({ query: 'test', filterRepo: 'liatrio' });

      expect(searchMock).toHaveBeenCalledWith(
        expect.any(Float32Array),
        expect.objectContaining({ filterRepo: 'liatrio' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return error when VectorStore not initialized', async () => {
      const mockStore = {
        getStats: () => ({ initialized: false, count: 0, dimensions: 0 }),
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);

      const result = await executeSearchExamples({ query: 'test' });

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('STORE_NOT_INITIALIZED');
      expect(result.results).toHaveLength(0);
    });

    it('should return error when API key is missing', async () => {
      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
      };

      const mockEmbedding = {
        hasApiKey: () => false,
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      const result = await executeSearchExamples({ query: 'test' });

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('API_KEY_MISSING');
    });

    it('should handle embedding generation errors', async () => {
      const mockStore = {
        getStats: () => ({ initialized: true, count: 10, dimensions: 1536 }),
      };

      const mockEmbedding = {
        hasApiKey: () => true,
        generateEmbedding: async () => {
          throw new Error('OpenAI API error');
        },
      };

      mockVectorStore.getInstance.mockReturnValue(mockStore);
      mockEmbeddingService.getInstance.mockReturnValue(mockEmbedding);

      const result = await executeSearchExamples({ query: 'test' });

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('SEARCH_ERROR');
      expect(result.error!.message).toContain('OpenAI API error');
    });
  });
});
