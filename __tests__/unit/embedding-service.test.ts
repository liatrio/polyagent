import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  EmbeddingService,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  BATCH_SIZE,
  MAX_RETRIES,
  INITIAL_BACKOFF_MS,
} from '../../src/lib/embedding-service';
import type { PolicyIndexEntry } from '../../src/lib/repo-manager';

describe('EmbeddingService (Story 3.2)', () => {
  let testDir: string;
  let service: EmbeddingService;
  const originalEnv = process.env;

  beforeEach(() => {
    testDir = join(tmpdir(), `polyagent-embedding-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Reset singleton
    EmbeddingService.resetInstance();

    // Set API key for tests
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };

    service = EmbeddingService.getInstance(testDir);
  });

  afterEach(() => {
    process.env = originalEnv;
    EmbeddingService.resetInstance();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('AC-3.2.1: System generates embeddings via OpenAI text-embedding-3-small', () => {
    it('should use text-embedding-3-small model', () => {
      expect(EMBEDDING_MODEL).toBe('text-embedding-3-small');
    });

    it('should have generateEmbedding method', () => {
      expect(typeof service.generateEmbedding).toBe('function');
    });
  });

  describe('AC-3.2.2: Embeddings are 1536-dimensional vectors', () => {
    it('should define 1536 dimensions', () => {
      expect(EMBEDDING_DIMENSIONS).toBe(1536);
    });

    it('should have generateBatch method', () => {
      expect(typeof service.generateBatch).toBe('function');
    });
  });

  describe('AC-3.2.3: Embedding input includes policy content + metadata', () => {
    it('should format embedding input with package name', () => {
      const entry: PolicyIndexEntry = {
        id: 'test-1',
        repo: 'test-repo',
        path: 'test.rego',
        packageName: 'authz.rbac',
        description: 'Test RBAC policy',
        tags: ['rbac', 'authz'],
        content: 'package authz.rbac\ndefault allow := false',
        lastUpdated: new Date().toISOString(),
      };

      const input = service.formatEmbeddingInput(entry);
      expect(input).toContain('Package: authz.rbac');
    });

    it('should include description in formatted input', () => {
      const entry: PolicyIndexEntry = {
        id: 'test-1',
        repo: 'test-repo',
        path: 'test.rego',
        packageName: 'test',
        description: 'This is a test policy',
        tags: [],
        content: 'package test',
        lastUpdated: new Date().toISOString(),
      };

      const input = service.formatEmbeddingInput(entry);
      expect(input).toContain('Description: This is a test policy');
    });

    it('should include tags in formatted input', () => {
      const entry: PolicyIndexEntry = {
        id: 'test-1',
        repo: 'test-repo',
        path: 'test.rego',
        packageName: 'test',
        description: 'Test',
        tags: ['kubernetes', 'security'],
        content: 'package test',
        lastUpdated: new Date().toISOString(),
      };

      const input = service.formatEmbeddingInput(entry);
      expect(input).toContain('Tags: kubernetes, security');
    });

    it('should include policy content in formatted input', () => {
      const entry: PolicyIndexEntry = {
        id: 'test-1',
        repo: 'test-repo',
        path: 'test.rego',
        packageName: 'test',
        description: 'Test',
        tags: [],
        content: 'package test\nallow := true',
        lastUpdated: new Date().toISOString(),
      };

      const input = service.formatEmbeddingInput(entry);
      expect(input).toContain('Policy:');
      expect(input).toContain('package test');
      expect(input).toContain('allow := true');
    });

    it('should skip unknown package name', () => {
      const entry: PolicyIndexEntry = {
        id: 'test-1',
        repo: 'test-repo',
        path: 'test.rego',
        packageName: 'unknown',
        description: 'Test',
        tags: [],
        content: 'package test',
        lastUpdated: new Date().toISOString(),
      };

      const input = service.formatEmbeddingInput(entry);
      expect(input).not.toContain('Package: unknown');
    });
  });

  describe('AC-3.2.4: Batched API requests for efficiency', () => {
    it('should define batch size of 100', () => {
      expect(BATCH_SIZE).toBe(100);
    });

    it('should have generateBatch method that takes array', () => {
      expect(typeof service.generateBatch).toBe('function');
      // Method signature accepts array of strings
      const fn = service.generateBatch;
      expect(fn).toBeDefined();
    });
  });

  describe('AC-3.2.5: Rate limiting with exponential backoff', () => {
    it('should define max retries', () => {
      expect(MAX_RETRIES).toBe(5);
    });

    it('should define initial backoff', () => {
      expect(INITIAL_BACKOFF_MS).toBe(1000);
    });
  });

  describe('AC-3.2.6: Embeddings persisted to embeddings.bin', () => {
    it('should save embeddings to file', async () => {
      // Load and save with mock data
      await service.loadEmbeddings();
      await service.saveEmbeddings();

      const embeddingsPath = join(testDir, 'embeddings.bin');
      expect(existsSync(embeddingsPath)).toBe(true);
    });

    it('should load embeddings from file', async () => {
      // Create mock cache file
      const cacheData = {
        metadata: {
          version: '1.0',
          modelName: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
          generatedAt: new Date().toISOString(),
          count: 1,
        },
        entries: [
          {
            id: 'test-1',
            contentHash: 'abc123',
            embedding: new Array(1536).fill(0.5),
          },
        ],
      };
      writeFileSync(join(testDir, 'embeddings.bin'), JSON.stringify(cacheData));

      const embeddings = await service.loadEmbeddings();
      expect(embeddings.size).toBe(1);
    });

    it('should return empty map for non-existent cache', async () => {
      const embeddings = await service.loadEmbeddings();
      expect(embeddings.size).toBe(0);
    });
  });

  describe('AC-3.2.7: Incremental embedding for new/changed policies', () => {
    it('should generate consistent content hash', () => {
      const hash1 = service.generateContentHash('test content');
      const hash2 = service.generateContentHash('test content');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = service.generateContentHash('content A');
      const hash2 = service.generateContentHash('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('should skip cached entries with matching hash', async () => {
      // Setup mock cache with existing entry
      const cacheData = {
        metadata: {
          version: '1.0',
          modelName: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
          generatedAt: new Date().toISOString(),
          count: 1,
        },
        entries: [
          {
            id: 'test-1',
            contentHash: '',  // Will be set below
            embedding: new Array(1536).fill(0.5),
          },
        ],
      };

      const entry: PolicyIndexEntry = {
        id: 'test-1',
        repo: 'test-repo',
        path: 'test.rego',
        packageName: 'test',
        description: 'Test',
        tags: [],
        content: 'package test',
        lastUpdated: new Date().toISOString(),
      };

      // Calculate matching hash
      const input = service.formatEmbeddingInput(entry);
      cacheData.entries[0].contentHash = service.generateContentHash(input);

      writeFileSync(join(testDir, 'embeddings.bin'), JSON.stringify(cacheData));

      const stats = await service.generateAllEmbeddings([entry]);
      expect(stats.cached).toBe(1);
      expect(stats.generated).toBe(0);
    });
  });

  describe('AC-3.2.8: Missing API key returns clear error', () => {
    it('should have hasApiKey method', () => {
      expect(typeof service.hasApiKey).toBe('function');
    });

    it('should return false when API key not set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(service.hasApiKey()).toBe(false);
    });

    it('should return true when API key is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(service.hasApiKey()).toBe(true);
    });

    it('should throw clear error when generating without API key', async () => {
      delete process.env.OPENAI_API_KEY;
      EmbeddingService.resetInstance();
      const noKeyService = EmbeddingService.getInstance(testDir);

      await expect(noKeyService.generateEmbedding('test')).rejects.toThrow(
        'OpenAI API key not found'
      );
    });

    it('should include help URL in error message', async () => {
      delete process.env.OPENAI_API_KEY;
      EmbeddingService.resetInstance();
      const noKeyService = EmbeddingService.getInstance(testDir);

      await expect(noKeyService.generateEmbedding('test')).rejects.toThrow(
        'platform.openai.com'
      );
    });
  });

  describe('AC-3.2.9: Cache tagged with model version', () => {
    it('should include model name in cache metadata', async () => {
      await service.loadEmbeddings();
      await service.saveEmbeddings();

      const data = JSON.parse(readFileSync(join(testDir, 'embeddings.bin'), 'utf-8'));
      expect(data.metadata.modelName).toBe(EMBEDDING_MODEL);
    });

    it('should include dimensions in cache metadata', async () => {
      await service.loadEmbeddings();
      await service.saveEmbeddings();

      const data = JSON.parse(readFileSync(join(testDir, 'embeddings.bin'), 'utf-8'));
      expect(data.metadata.dimensions).toBe(EMBEDDING_DIMENSIONS);
    });

    it('should invalidate cache when model changes', async () => {
      // Create cache with different model
      const cacheData = {
        metadata: {
          version: '1.0',
          modelName: 'old-model',  // Different from current model
          dimensions: EMBEDDING_DIMENSIONS,
          generatedAt: new Date().toISOString(),
          count: 1,
        },
        entries: [
          {
            id: 'test-1',
            contentHash: 'abc',
            embedding: new Array(1536).fill(0.5),
          },
        ],
      };
      writeFileSync(join(testDir, 'embeddings.bin'), JSON.stringify(cacheData));

      const embeddings = await service.loadEmbeddings();
      // Should return empty because model mismatch
      expect(embeddings.size).toBe(0);
    });
  });

  describe('Additional functionality', () => {
    it('should get embedding by ID', async () => {
      // Load cache with entry
      const cacheData = {
        metadata: {
          version: '1.0',
          modelName: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
          generatedAt: new Date().toISOString(),
          count: 1,
        },
        entries: [
          {
            id: 'test-1',
            contentHash: 'abc',
            embedding: new Array(1536).fill(0.5),
          },
        ],
      };
      writeFileSync(join(testDir, 'embeddings.bin'), JSON.stringify(cacheData));
      await service.loadEmbeddings();

      const embedding = service.getEmbedding('test-1');
      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding?.length).toBe(1536);
    });

    it('should return null for non-existent embedding', async () => {
      await service.loadEmbeddings();
      const embedding = service.getEmbedding('non-existent');
      expect(embedding).toBeNull();
    });

    it('should get all embeddings', async () => {
      const cacheData = {
        metadata: {
          version: '1.0',
          modelName: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
          generatedAt: new Date().toISOString(),
          count: 2,
        },
        entries: [
          { id: 'test-1', contentHash: 'abc', embedding: new Array(1536).fill(0.5) },
          { id: 'test-2', contentHash: 'def', embedding: new Array(1536).fill(0.7) },
        ],
      };
      writeFileSync(join(testDir, 'embeddings.bin'), JSON.stringify(cacheData));
      await service.loadEmbeddings();

      const all = service.getAllEmbeddings();
      expect(all.size).toBe(2);
      expect(all.has('test-1')).toBe(true);
      expect(all.has('test-2')).toBe(true);
    });

    it('should clear cache', async () => {
      const cacheData = {
        metadata: {
          version: '1.0',
          modelName: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
          generatedAt: new Date().toISOString(),
          count: 1,
        },
        entries: [{ id: 'test-1', contentHash: 'abc', embedding: new Array(1536).fill(0.5) }],
      };
      writeFileSync(join(testDir, 'embeddings.bin'), JSON.stringify(cacheData));
      await service.loadEmbeddings();

      service.clearCache();
      expect(service.getCacheStats().count).toBe(0);
    });

    it('should report cache stats', async () => {
      await service.loadEmbeddings();
      const stats = service.getCacheStats();
      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('modelName');
      expect(stats.modelName).toBe(EMBEDDING_MODEL);
    });
  });
});
