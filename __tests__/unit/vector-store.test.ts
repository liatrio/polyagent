import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  cosineSimilarity,
  createVectorStoreData,
  searchVectorStore,
  VectorStore,
} from '../../src/lib/vector-store';
import type { PolicyIndexEntry } from '../../src/lib/repo-manager';

describe('VectorStore (Story 3.3)', () => {
  describe('AC-3.3.4: Cosine similarity search implemented', () => {
    it('should return 1.0 for identical vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });

    it('should return 0.0 for orthogonal vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it('should return -1.0 for opposite vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([-1, 0, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it('should return correct similarity for known vectors', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);
      // dot = 4 + 10 + 18 = 32
      // |a| = sqrt(1+4+9) = sqrt(14)
      // |b| = sqrt(16+25+36) = sqrt(77)
      // cos = 32 / (sqrt(14) * sqrt(77)) = 32 / sqrt(1078) ≈ 0.9746
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.9746, 3);
    });

    it('should throw on dimension mismatch', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([1, 2]);
      expect(() => cosineSimilarity(a, b)).toThrow(/dimension mismatch/i);
    });

    it('should return 0 for zero vector', () => {
      const a = new Float32Array([0, 0, 0]);
      const b = new Float32Array([1, 2, 3]);
      expect(cosineSimilarity(a, b)).toBe(0);
    });
  });

  describe('AC-3.3.7: Results ranked by similarity score (descending)', () => {
    const makeEntry = (id: string, repo: string): PolicyIndexEntry => ({
      id,
      repo,
      path: `${id}.rego`,
      packageName: id,
      description: `Policy ${id}`,
      tags: [],
      content: '',
      lastUpdated: new Date().toISOString(),
    });

    it('should rank results by descending similarity', () => {
      const entries = [
        makeEntry('low', 'repo-a'),
        makeEntry('high', 'repo-b'),
        makeEntry('mid', 'repo-c'),
      ];

      // vectors designed so high > mid > low similarity to query [1,0,0]
      const vectors = [
        new Float32Array([0, 0, 1]),       // low: orthogonal, sim ~0
        new Float32Array([1, 0, 0]),       // high: parallel, sim = 1.0
        new Float32Array([0.7, 0.7, 0]),   // mid: sim ~0.7
      ];

      const data = createVectorStoreData({ entries, vectors });
      const query = new Float32Array([1, 0, 0]);

      const results = searchVectorStore(data, query, { limit: 10, threshold: 0 });

      expect(results.length).toBe(3);
      expect(results[0].entry.id).toBe('high');
      expect(results[1].entry.id).toBe('mid');
      expect(results[2].entry.id).toBe('low');

      // verify scores are descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarityScore).toBeGreaterThanOrEqual(results[i].similarityScore);
      }
    });

    it('should respect limit option', () => {
      const entries = Array.from({ length: 10 }, (_, i) => makeEntry(`entry-${i}`, 'repo'));
      const vectors = entries.map((_, i) => {
        const v = new Float32Array(3);
        v[0] = i / 10;
        v[1] = 0.5;
        v[2] = 0.5;
        return v;
      });

      const data = createVectorStoreData({ entries, vectors });
      const query = new Float32Array([1, 0.5, 0.5]);

      const results = searchVectorStore(data, query, { limit: 3, threshold: 0 });
      expect(results.length).toBe(3);
    });
  });

  describe('AC-3.3.8: Filtering by repository supported', () => {
    const makeEntry = (id: string, repo: string): PolicyIndexEntry => ({
      id,
      repo,
      path: `${id}.rego`,
      packageName: id,
      description: `Policy ${id}`,
      tags: [],
      content: '',
      lastUpdated: new Date().toISOString(),
    });

    it('should filter results by filterRepo', () => {
      const entries = [
        makeEntry('a1', 'repo-a'),
        makeEntry('b1', 'repo-b'),
        makeEntry('a2', 'repo-a'),
      ];

      const vectors = [
        new Float32Array([1, 0, 0]),
        new Float32Array([0.9, 0.1, 0]),
        new Float32Array([0.8, 0.2, 0]),
      ];

      const data = createVectorStoreData({ entries, vectors });
      const query = new Float32Array([1, 0, 0]);

      const results = searchVectorStore(data, query, { filterRepo: 'repo-a', threshold: 0 });

      expect(results.every(r => r.entry.repo === 'repo-a')).toBe(true);
      expect(results.length).toBe(2);
    });

    it('should handle case-insensitive filterRepo', () => {
      const entries = [makeEntry('x', 'Liatrio')];
      const vectors = [new Float32Array([1, 0, 0])];

      const data = createVectorStoreData({ entries, vectors });
      const query = new Float32Array([1, 0, 0]);

      const results = searchVectorStore(data, query, { filterRepo: 'liatrio', threshold: 0 });
      expect(results.length).toBe(1);
    });

    it('should return empty array when filterRepo matches nothing', () => {
      const entries = [makeEntry('x', 'repo-a')];
      const vectors = [new Float32Array([1, 0, 0])];

      const data = createVectorStoreData({ entries, vectors });
      const query = new Float32Array([1, 0, 0]);

      const results = searchVectorStore(data, query, { filterRepo: 'nonexistent' });
      expect(results.length).toBe(0);
    });
  });

  describe('AC-3.3.9: Low-scoring results (< 0.5) trigger no relevant results', () => {
    const makeEntry = (id: string): PolicyIndexEntry => ({
      id,
      repo: 'test-repo',
      path: `${id}.rego`,
      packageName: id,
      description: `Policy ${id}`,
      tags: [],
      content: '',
      lastUpdated: new Date().toISOString(),
    });

    it('should return empty array when all scores below threshold', () => {
      // orthogonal vectors have 0 similarity
      const entries = [makeEntry('a'), makeEntry('b')];
      const vectors = [
        new Float32Array([1, 0, 0]),
        new Float32Array([0, 1, 0]),
      ];

      const data = createVectorStoreData({ entries, vectors });
      const query = new Float32Array([0, 0, 1]); // orthogonal to both

      const results = searchVectorStore(data, query, { threshold: 0.5 });
      expect(results.length).toBe(0);
    });

    it('should use default threshold of 0.5', () => {
      const entries = [makeEntry('low'), makeEntry('high')];
      // low: orthogonal to query -> sim = 0
      // high: parallel to query -> sim = 1.0
      const vectors = [
        new Float32Array([0, 1, 0]),  // orthogonal to [1,0,0]
        new Float32Array([1, 0, 0]),  // parallel to [1,0,0]
      ];

      const data = createVectorStoreData({ entries, vectors });
      const query = new Float32Array([1, 0, 0]);

      const results = searchVectorStore(data, query); // default threshold 0.5
      expect(results.length).toBe(1);
      expect(results[0].entry.id).toBe('high');
    });

    it('should respect custom threshold', () => {
      const entries = [makeEntry('a')];
      // vector at ~45 degrees from query -> sim ~0.707
      const vectors = [new Float32Array([1, 1, 0])];

      const data = createVectorStoreData({ entries, vectors });
      const query = new Float32Array([1, 0, 0]);

      // similarity is 1 / sqrt(2) ≈ 0.707
      // with threshold 0.5, should return result
      const results1 = searchVectorStore(data, query, { threshold: 0.5 });
      expect(results1.length).toBe(1);

      // with threshold 0.9, should return nothing (0.707 < 0.9)
      const results2 = searchVectorStore(data, query, { threshold: 0.9 });
      expect(results2.length).toBe(0);
    });
  });

  describe('AC-3.3.6: Similarity computation < 50ms for 1000 policies', () => {
    it('should compute similarity for 1000 entries in under 50ms', () => {
      const count = 1000;
      const dim = 1536; // openai embedding dimension

      const entries: PolicyIndexEntry[] = Array.from({ length: count }, (_, i) => ({
        id: `policy-${i}`,
        repo: `repo-${i % 5}`,
        path: `policy-${i}.rego`,
        packageName: `pkg${i}`,
        description: `Policy ${i}`,
        tags: [],
        content: '',
        lastUpdated: new Date().toISOString(),
      }));

      // generate random vectors
      const vectors: Float32Array[] = entries.map(() => {
        const v = new Float32Array(dim);
        for (let j = 0; j < dim; j++) {
          v[j] = Math.random();
        }
        return v;
      });

      const data = createVectorStoreData({ entries, vectors });

      const query = new Float32Array(dim);
      for (let j = 0; j < dim; j++) {
        query[j] = Math.random();
      }

      const start = performance.now();
      searchVectorStore(data, query, { limit: 10, threshold: 0 });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('AC-3.3.3: Memory footprint < 500MB for ~1000 policies', () => {
    it('should estimate memory usage correctly', () => {
      const count = 1000;
      const dim = 1536;

      const entries: PolicyIndexEntry[] = Array.from({ length: count }, (_, i) => ({
        id: `policy-${i}`,
        repo: 'test-repo',
        path: `policy-${i}.rego`,
        packageName: `pkg${i}`,
        description: `Policy ${i}`,
        tags: [],
        content: '',
        lastUpdated: new Date().toISOString(),
      }));

      const vectors: Float32Array[] = entries.map(() => new Float32Array(dim));
      const data = createVectorStoreData({ entries, vectors });

      // expected: 1000 vectors * 1536 dims * 4 bytes + 1000 norms * 4 bytes
      // = 6,144,000 + 4,000 = 6,148,000 bytes ≈ 6MB
      const expectedBytes = count * dim * 4 + count * 4;

      // use a simple calculation since we don't have getMemoryUsageBytes on data directly
      const vectorBytes = data.vectors.length * data.dimensions * Float32Array.BYTES_PER_ELEMENT;
      const normBytes = data.norms.length * Float32Array.BYTES_PER_ELEMENT;
      const totalBytes = vectorBytes + normBytes;

      expect(totalBytes).toBe(expectedBytes);
      expect(totalBytes).toBeLessThan(500 * 1024 * 1024); // < 500MB
    });
  });

  describe('VectorStore singleton', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `polyagent-vector-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      VectorStore.resetInstance();
    });

    afterEach(() => {
      VectorStore.resetInstance();
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should throw if index.json is missing', async () => {
      const store = VectorStore.getInstance(testDir);
      await expect(store.initialize()).rejects.toThrow(/index not found/i);
    });

    it('should throw if embeddings.bin is missing', async () => {
      writeFileSync(join(testDir, 'index.json'), JSON.stringify({ entries: [] }));
      const store = VectorStore.getInstance(testDir);
      await expect(store.initialize()).rejects.toThrow(/embeddings.*not found/i);
    });

    it('should load and search with valid data files', async () => {
      const indexData = {
        version: '1.0',
        entries: [
          {
            id: 'test-1',
            repo: 'test-repo',
            path: 'test.rego',
            packageName: 'test',
            description: 'Test policy',
            tags: ['test'],
            content: 'package test',
            lastUpdated: new Date().toISOString(),
          },
        ],
      };

      const embeddingsData = {
        metadata: { dimensions: 3 },
        entries: [
          { id: 'test-1', embedding: [1, 0, 0] },
        ],
      };

      writeFileSync(join(testDir, 'index.json'), JSON.stringify(indexData));
      writeFileSync(join(testDir, 'embeddings.bin'), JSON.stringify(embeddingsData));

      const store = VectorStore.getInstance(testDir);
      await store.initialize();

      const stats = store.getStats();
      expect(stats.initialized).toBe(true);
      expect(stats.count).toBe(1);
      expect(stats.dimensions).toBe(3);

      const results = store.search(new Float32Array([1, 0, 0]), { threshold: 0 });
      expect(results.length).toBe(1);
      expect(results[0].entry.id).toBe('test-1');
      expect(results[0].similarityScore).toBeCloseTo(1.0, 5);
    });

    it('should throw if search called before initialize', () => {
      const store = VectorStore.getInstance(testDir);
      expect(() => store.search(new Float32Array([1, 0, 0]))).toThrow(/not initialized/i);
    });

    it('should return singleton instance', () => {
      const store1 = VectorStore.getInstance(testDir);
      const store2 = VectorStore.getInstance();
      expect(store1).toBe(store2);
    });
  });

  describe('createVectorStoreData validation', () => {
    const makeEntry = (id: string): PolicyIndexEntry => ({
      id,
      repo: 'test',
      path: `${id}.rego`,
      packageName: id,
      description: '',
      tags: [],
      content: '',
      lastUpdated: new Date().toISOString(),
    });

    it('should throw on entries/vectors length mismatch', () => {
      const entries = [makeEntry('a'), makeEntry('b')];
      const vectors = [new Float32Array([1, 0, 0])];
      expect(() => createVectorStoreData({ entries, vectors })).toThrow(/length mismatch/i);
    });

    it('should throw on zero entries', () => {
      expect(() => createVectorStoreData({ entries: [], vectors: [] })).toThrow(/zero entries/i);
    });

    it('should throw on dimension mismatch in vectors', () => {
      const entries = [makeEntry('a'), makeEntry('b')];
      const vectors = [
        new Float32Array([1, 0, 0]),
        new Float32Array([1, 0]), // wrong dimension
      ];
      expect(() => createVectorStoreData({ entries, vectors })).toThrow(/dimension mismatch/i);
    });
  });

  describe('searchVectorStore edge cases', () => {
    const makeEntry = (id: string): PolicyIndexEntry => ({
      id,
      repo: 'test',
      path: `${id}.rego`,
      packageName: id,
      description: '',
      tags: [],
      content: '',
      lastUpdated: new Date().toISOString(),
    });

    it('should throw on query dimension mismatch', () => {
      const entries = [makeEntry('a')];
      const vectors = [new Float32Array([1, 0, 0])];
      const data = createVectorStoreData({ entries, vectors });

      expect(() => searchVectorStore(data, new Float32Array([1, 0]))).toThrow(/dimension mismatch/i);
    });

    it('should return empty array for zero query vector', () => {
      const entries = [makeEntry('a')];
      const vectors = [new Float32Array([1, 0, 0])];
      const data = createVectorStoreData({ entries, vectors });

      const results = searchVectorStore(data, new Float32Array([0, 0, 0]));
      expect(results.length).toBe(0);
    });

    it('should return empty array for limit <= 0', () => {
      const entries = [makeEntry('a')];
      const vectors = [new Float32Array([1, 0, 0])];
      const data = createVectorStoreData({ entries, vectors });

      const results = searchVectorStore(data, new Float32Array([1, 0, 0]), { limit: 0 });
      expect(results.length).toBe(0);
    });
  });
});
