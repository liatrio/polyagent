import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { PolicyIndexEntry } from './repo-manager.js';

export type SearchOptions = {
  limit?: number;
  filterRepo?: string;
  threshold?: number;
};

export type SearchResult = {
  entry: PolicyIndexEntry;
  similarityScore: number;
};

export type VectorStoreData = {
  dimensions: number;
  entries: PolicyIndexEntry[];
  vectors: Float32Array[];
  norms: Float32Array;
};

const dotProduct = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
};

const l2Norm = (v: Float32Array): number => {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) {
    const value = v[i];
    sumSq += value * value;
  }
  return Math.sqrt(sumSq);
};

export const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: a=${a.length}, b=${b.length}`);
  }

  const aNorm = l2Norm(a);
  const bNorm = l2Norm(b);
  if (aNorm === 0 || bNorm === 0) {
    return 0;
  }

  return dotProduct(a, b) / (aNorm * bNorm);
};

export const createVectorStoreData = (args: {
  entries: PolicyIndexEntry[];
  vectors: Float32Array[];
}): VectorStoreData => {
  const { entries, vectors } = args;

  if (entries.length !== vectors.length) {
    throw new Error(`entries/vectors length mismatch: ${entries.length} vs ${vectors.length}`);
  }

  if (entries.length === 0) {
    throw new Error('Cannot create VectorStoreData with zero entries');
  }

  const dimensions = vectors[0].length;
  const norms = new Float32Array(vectors.length);

  for (let i = 0; i < vectors.length; i++) {
    const vec = vectors[i];
    if (vec.length !== dimensions) {
      throw new Error(`Embedding dimension mismatch at index ${i}: expected ${dimensions}, got ${vec.length}`);
    }
    norms[i] = l2Norm(vec);
  }

  return {
    dimensions,
    entries,
    vectors,
    norms,
  };
};

export const searchVectorStore = (
  data: VectorStoreData,
  queryEmbedding: Float32Array,
  options: SearchOptions = {}
): SearchResult[] => {
  if (queryEmbedding.length !== data.dimensions) {
    throw new Error(
      `Query embedding dimension mismatch: expected ${data.dimensions}, got ${queryEmbedding.length}`
    );
  }

  const limit = options.limit ?? 3;
  const threshold = options.threshold ?? 0.5;
  const filterRepo = options.filterRepo ? options.filterRepo.trim().toLowerCase() : null;

  if (limit <= 0) {
    return [];
  }

  const queryNorm = l2Norm(queryEmbedding);
  if (queryNorm === 0) {
    return [];
  }

  const results: SearchResult[] = [];

  for (let i = 0; i < data.vectors.length; i++) {
    const entry = data.entries[i];
    if (filterRepo && entry.repo.toLowerCase() !== filterRepo) {
      continue;
    }

    const denom = data.norms[i] * queryNorm;
    if (denom === 0) {
      continue;
    }

    const score = dotProduct(queryEmbedding, data.vectors[i]) / denom;
    if (score >= threshold) {
      results.push({ entry, similarityScore: score });
    }
  }

  results.sort((a, b) => b.similarityScore - a.similarityScore);
  return results.slice(0, limit);
};

export type VectorStore = {
  initialize: () => Promise<void>;
  search: (queryEmbedding: Float32Array, options?: SearchOptions) => SearchResult[];
  getStats: () => { initialized: boolean; count: number; dimensions: number };
  getMemoryUsageBytes: () => number;
};

type PolicyIndexFile = {
  entries?: PolicyIndexEntry[];
};

type EmbeddingsFile = {
  metadata?: {
    dimensions?: number;
  };
  entries?: Array<{
    id: string;
    embedding: number[];
  }>;
};

const getDefaultBaseDir = (): string => {
  const configDir = process.env.POLYAGENT_CONFIG_DIR ?? join(homedir(), '.polyagent');
  return join(configDir, 'policy-examples');
};

const createVectorStore = (baseDir: string): VectorStore => {
  let initialized = false;
  let data: VectorStoreData | null = null;

  const initialize = async (): Promise<void> => {
    if (initialized) return;

    const indexPath = join(baseDir, 'index.json');
    const embeddingsPath = join(baseDir, 'embeddings.bin');

    if (!existsSync(indexPath)) {
      throw new Error(`Policy index not found: ${indexPath}`);
    }

    if (!existsSync(embeddingsPath)) {
      throw new Error(`Embeddings cache not found: ${embeddingsPath}`);
    }

    const indexRaw = JSON.parse(await readFile(indexPath, 'utf-8')) as PolicyIndexFile;
    const indexEntries = indexRaw.entries ?? [];

    const embeddingsRaw = JSON.parse(await readFile(embeddingsPath, 'utf-8')) as EmbeddingsFile;
    const embeddingEntries = embeddingsRaw.entries ?? [];

    const dimensions = embeddingsRaw.metadata?.dimensions ?? embeddingEntries[0]?.embedding?.length;
    if (!dimensions) {
      throw new Error('Embeddings file missing dimensions');
    }

    const embeddingById = new Map<string, Float32Array>();
    for (const item of embeddingEntries) {
      if (item.embedding.length !== dimensions) {
        throw new Error(
          `Embedding dimension mismatch for id=${item.id}: expected ${dimensions}, got ${item.embedding.length}`
        );
      }
      embeddingById.set(item.id, Float32Array.from(item.embedding));
    }

    const entries: PolicyIndexEntry[] = [];
    const vectors: Float32Array[] = [];

    for (const entry of indexEntries) {
      const embedding = embeddingById.get(entry.id);
      if (!embedding) {
        continue;
      }

      entries.push(entry);
      vectors.push(embedding);
    }

    if (entries.length === 0) {
      throw new Error('No embeddings matched policy index entries');
    }

    data = createVectorStoreData({ entries, vectors });
    initialized = true;
  };

  const search = (queryEmbedding: Float32Array, options: SearchOptions = {}): SearchResult[] => {
    if (!initialized || !data) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }

    return searchVectorStore(data, queryEmbedding, options);
  };

  const getStats = (): { initialized: boolean; count: number; dimensions: number } => ({
    initialized,
    count: data ? data.entries.length : 0,
    dimensions: data ? data.dimensions : 0,
  });

  const getMemoryUsageBytes = (): number => {
    if (!data) {
      return 0;
    }

    const vectorBytes = data.vectors.length * data.dimensions * Float32Array.BYTES_PER_ELEMENT;
    const normBytes = data.norms.length * Float32Array.BYTES_PER_ELEMENT;
    return vectorBytes + normBytes;
  };

  return {
    initialize,
    search,
    getStats,
    getMemoryUsageBytes,
  };
};

let instance: VectorStore | null = null;

export const VectorStore = {
  getInstance(baseDir?: string): VectorStore {
    if (!instance) {
      instance = createVectorStore(baseDir ?? getDefaultBaseDir());
    }
    return instance;
  },

  resetInstance(): void {
    instance = null;
  },
};
