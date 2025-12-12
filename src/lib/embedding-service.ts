/**
 * Embedding Service for Policy Examples
 *
 * Generates vector embeddings for policy examples using OpenAI's text-embedding-3-small model.
 * Story 3.2: Embedding Generation Pipeline
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import type { PolicyIndexEntry } from './repo-manager.js';

/** Debug logger */
const debug = (msg: string) => {
  if (process.env.DEBUG) {
    console.log(`[embedding-service] ${msg}`);
  }
};

/**
 * Embedding model configuration
 * AC-3.2.1: System generates embeddings via OpenAI text-embedding-3-small
 * AC-3.2.2: Embeddings are 1536-dimensional vectors
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Batching configuration
 * AC-3.2.4: Batched API requests for efficiency
 */
export const BATCH_SIZE = 100;

/**
 * Rate limiting configuration
 * AC-3.2.5: Rate limiting with exponential backoff
 */
export const MAX_RETRIES = 5;
export const INITIAL_BACKOFF_MS = 1000;

/**
 * Embedding cache entry
 */
export interface EmbeddingCacheEntry {
  id: string;
  contentHash: string;
  embedding: number[];
}

/**
 * Embedding cache metadata
 * AC-3.2.9: Cache tagged with model version
 */
export interface EmbeddingCacheMetadata {
  version: string;
  modelName: string;
  dimensions: number;
  generatedAt: string;
  count: number;
}

/**
 * Full embedding cache structure
 */
export interface EmbeddingCache {
  metadata: EmbeddingCacheMetadata;
  entries: EmbeddingCacheEntry[];
}

/**
 * Progress callback for batch operations
 */
export type ProgressCallback = (completed: number, total: number) => void;

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  id: string;
  embedding: Float32Array;
}

/**
 * Embedding generation statistics
 */
export interface EmbeddingStats {
  total: number;
  generated: number;
  cached: number;
  failed: number;
}

/**
 * Embedding Service
 *
 * Handles embedding generation, caching, and persistence for policy examples.
 */
export class EmbeddingService {
  private static instance: EmbeddingService;
  private client: OpenAI | null = null;
  private cacheDir: string;
  private embeddingsPath: string;
  private cache: Map<string, EmbeddingCacheEntry> = new Map();

  private constructor(baseDir: string) {
    this.cacheDir = baseDir;
    this.embeddingsPath = join(baseDir, 'embeddings.bin');
  }

  /**
   * Get singleton instance
   * AC-3.2.8: Missing API key returns clear error (checked on first use)
   */
  static getInstance(baseDir?: string): EmbeddingService {
    if (!EmbeddingService.instance) {
      if (!baseDir) {
        throw new Error('baseDir required for first initialization');
      }
      EmbeddingService.instance = new EmbeddingService(baseDir);
    }
    return EmbeddingService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    EmbeddingService.instance = null as unknown as EmbeddingService;
  }

  /**
   * Initialize the OpenAI client
   * AC-3.2.8: Missing API key returns clear error
   */
  private initializeClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenAI API key not found. Set the OPENAI_API_KEY environment variable.\n' +
          'Get your API key at: https://platform.openai.com/api-keys'
      );
    }

    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  /**
   * Check if API key is available
   */
  hasApiKey(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Generate content hash for change detection
   * AC-3.2.7: Incremental embedding for new/changed policies
   */
  generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Format policy content for embedding
   * AC-3.2.3: Embedding input includes policy content + metadata
   */
  formatEmbeddingInput(entry: PolicyIndexEntry): string {
    const parts: string[] = [];

    // Add package name
    if (entry.packageName && entry.packageName !== 'unknown') {
      parts.push(`Package: ${entry.packageName}`);
    }

    // Add description
    if (entry.description) {
      parts.push(`Description: ${entry.description}`);
    }

    // Add tags
    if (entry.tags && entry.tags.length > 0) {
      parts.push(`Tags: ${entry.tags.join(', ')}`);
    }

    // Add policy content
    parts.push('Policy:');
    parts.push(entry.content);

    return parts.join('\n');
  }

  /**
   * Generate embedding for a single text
   * AC-3.2.1: System generates embeddings via OpenAI text-embedding-3-small
   * AC-3.2.2: Embeddings are 1536-dimensional vectors
   */
  async generateEmbedding(content: string): Promise<Float32Array> {
    const client = this.initializeClient();

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: content,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0].embedding;
    return new Float32Array(embedding);
  }

  /**
   * Generate embeddings for a batch of texts with retry logic
   * AC-3.2.4: Batched API requests for efficiency
   * AC-3.2.5: Rate limiting with exponential backoff
   */
  async generateBatch(contents: string[]): Promise<Float32Array[]> {
    const client = this.initializeClient();
    let attempt = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (attempt < MAX_RETRIES) {
      try {
        const response = await client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: contents,
          dimensions: EMBEDDING_DIMENSIONS,
        });

        // Sort by index to ensure correct order
        const sorted = response.data.sort((a, b) => a.index - b.index);
        return sorted.map((item) => new Float32Array(item.embedding));
      } catch (error) {
        attempt++;

        // Check if rate limited (429)
        if (error instanceof OpenAI.RateLimitError) {
          if (attempt >= MAX_RETRIES) {
            throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries: ${error.message}`);
          }

          debug(`Rate limited, waiting ${backoff}ms before retry ${attempt}/${MAX_RETRIES}`);
          await this.sleep(backoff);
          backoff *= 2; // Exponential backoff
          continue;
        }

        // Re-throw other errors
        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate embeddings for all policy entries with incremental updates
   * AC-3.2.7: Incremental embedding for new/changed policies
   */
  async generateAllEmbeddings(
    entries: PolicyIndexEntry[],
    onProgress?: ProgressCallback
  ): Promise<EmbeddingStats> {
    // Load existing cache
    await this.loadEmbeddings();

    const stats: EmbeddingStats = {
      total: entries.length,
      generated: 0,
      cached: 0,
      failed: 0,
    };

    // Identify entries needing embedding
    const needsEmbedding: { entry: PolicyIndexEntry; input: string; hash: string }[] = [];

    for (const entry of entries) {
      const input = this.formatEmbeddingInput(entry);
      const hash = this.generateContentHash(input);

      // Check cache
      const cached = this.cache.get(entry.id);
      if (cached && cached.contentHash === hash) {
        stats.cached++;
        continue;
      }

      needsEmbedding.push({ entry, input, hash });
    }

    debug(`Need to generate ${needsEmbedding.length} embeddings (${stats.cached} cached)`);

    // Process in batches
    for (let i = 0; i < needsEmbedding.length; i += BATCH_SIZE) {
      const batch = needsEmbedding.slice(i, i + BATCH_SIZE);
      const inputs = batch.map((b) => b.input);

      try {
        const embeddings = await this.generateBatch(inputs);

        // Store results in cache
        for (let j = 0; j < batch.length; j++) {
          const { entry, hash } = batch[j];
          const embedding = embeddings[j];

          this.cache.set(entry.id, {
            id: entry.id,
            contentHash: hash,
            embedding: Array.from(embedding),
          });
          stats.generated++;
        }
      } catch (error) {
        debug(`Batch failed: ${error}`);
        stats.failed += batch.length;
      }

      // Report progress
      if (onProgress) {
        onProgress(stats.cached + stats.generated + stats.failed, stats.total);
      }
    }

    // Save updated cache
    await this.saveEmbeddings();

    return stats;
  }

  /**
   * Get embedding for a policy by ID
   */
  getEmbedding(id: string): Float32Array | null {
    const cached = this.cache.get(id);
    if (!cached) {
      return null;
    }
    return new Float32Array(cached.embedding);
  }

  /**
   * Get all embeddings as a Map
   */
  getAllEmbeddings(): Map<string, Float32Array> {
    const result = new Map<string, Float32Array>();
    for (const [id, entry] of this.cache) {
      result.set(id, new Float32Array(entry.embedding));
    }
    return result;
  }

  /**
   * Save embeddings to binary file
   * AC-3.2.6: Embeddings persisted to embeddings.bin
   * AC-3.2.9: Cache tagged with model version
   */
  async saveEmbeddings(): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.embeddingsPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const cacheData: EmbeddingCache = {
      metadata: {
        version: '1.0',
        modelName: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        generatedAt: new Date().toISOString(),
        count: this.cache.size,
      },
      entries: Array.from(this.cache.values()),
    };

    // Write as JSON (can be optimized to binary later)
    writeFileSync(this.embeddingsPath, JSON.stringify(cacheData));
    debug(`Saved ${this.cache.size} embeddings to ${this.embeddingsPath}`);
  }

  /**
   * Load embeddings from binary file
   * AC-3.2.6: Embeddings persisted to embeddings.bin
   * AC-3.2.9: Cache tagged with model version
   */
  async loadEmbeddings(): Promise<Map<string, Float32Array>> {
    this.cache.clear();

    if (!existsSync(this.embeddingsPath)) {
      debug('No embeddings cache found');
      return new Map();
    }

    try {
      const data = readFileSync(this.embeddingsPath, 'utf-8');
      const cacheData: EmbeddingCache = JSON.parse(data);

      // Validate model version
      if (cacheData.metadata.modelName !== EMBEDDING_MODEL) {
        debug(
          `Model mismatch: cached=${cacheData.metadata.modelName}, current=${EMBEDDING_MODEL}. Rebuilding.`
        );
        return new Map();
      }

      // Load entries
      for (const entry of cacheData.entries) {
        this.cache.set(entry.id, entry);
      }

      debug(`Loaded ${this.cache.size} embeddings from cache`);
      return this.getAllEmbeddings();
    } catch (error) {
      debug(`Failed to load embeddings cache: ${error}`);
      return new Map();
    }
  }

  /**
   * Clear all cached embeddings
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { count: number; modelName: string } {
    return {
      count: this.cache.size,
      modelName: EMBEDDING_MODEL,
    };
  }
}
