import { z } from 'zod';
import { VectorStore, type SearchResult } from '../lib/vector-store.js';
import { EmbeddingService } from '../lib/embedding-service.js';
import { LoggerService } from '../services/logger.js';

/**
 * Maximum number of lines to include in snippets
 * AC-3.4.5: Snippets truncated to 200 lines max
 */
const MAX_SNIPPET_LINES = 200;

/**
 * Default similarity threshold for results
 * Configurable via POLYAGENT_SEARCH_THRESHOLD environment variable
 */
const DEFAULT_SIMILARITY_THRESHOLD = parseFloat(process.env.POLYAGENT_SEARCH_THRESHOLD ?? '0.5');

/**
 * Policy domain suggestions for empty results
 * Extracted for maintainability
 */
const DOMAIN_SUGGESTIONS: Record<string, string[]> = {
  kubernetes: ['k8s admission control', 'pod security', 'container policy'],
  k8s: ['kubernetes admission', 'gatekeeper constraint', 'pod security policy'],
  rbac: ['role-based access control', 'authorization policy', 'permission policy'],
  terraform: ['infrastructure policy', 'cloud resource validation', 'IaC compliance'],
  aws: ['cloud security', 'resource tagging', 'IAM policy'],
  security: ['compliance policy', 'admission control', 'authorization'],
  container: ['pod security', 'image policy', 'kubernetes workload'],
  authorization: ['rbac', 'access control', 'permission check'],
  compliance: ['security policy', 'audit policy', 'governance'],
  gatekeeper: ['kubernetes constraint', 'admission controller', 'opa policy'],
  sigstore: ['supply chain security', 'image signing', 'attestation'],
  iac: ['terraform policy', 'infrastructure validation', 'cloud compliance'],
};

const DEFAULT_SUGGESTIONS = [
  'Try more specific terms like "kubernetes admission" or "rbac policy"',
  'Include policy type: "deny", "allow", "validation"',
  'Specify a domain: kubernetes, terraform, aws, gcp',
];

/**
 * Input schema for the search_policy_examples tool
 * AC-3.4.2: Accepts query (required), limit (optional, default 3, max 10), filterRepo (optional)
 */
const SearchExamplesInput = z.object({
  query: z.string().min(1).describe('Natural language search query for policy examples'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Maximum number of results to return (1-10, default: 3)'),
  filterRepo: z.string().optional().describe('Filter results to a specific repository name'),
});

/**
 * Policy example result structure
 * AC-3.4.4: Returns repo, path, snippet, description, tags, similarityScore
 */
export interface PolicyExample {
  repo: string;
  path: string;
  snippet: string;
  description: string;
  tags: string[];
  similarityScore: number;
}

/**
 * Output schema for the search_policy_examples tool
 */
const PolicyExampleSchema = z.object({
  repo: z.string(),
  path: z.string(),
  snippet: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  similarityScore: z.number(),
});

const SearchExamplesOutput = z.object({
  results: z.array(PolicyExampleSchema),
  totalFound: z.number(),
  suggestions: z.array(z.string()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

/**
 * Schema for the `search_policy_examples` tool
 * AC-3.4.1: Tool registered with name search_policy_examples
 */
export const SearchExamplesToolSchema = {
  name: 'search_policy_examples',
  description:
    'Semantic search over curated policy repositories to find OPA/Rego policy examples. ' +
    'Use this to discover proven implementation patterns, RBAC policies, Kubernetes admission controls, ' +
    'and other security/compliance policies.',
  input: SearchExamplesInput,
  output: SearchExamplesOutput,
};

export type SearchExamplesInputType = z.input<typeof SearchExamplesInput>;
export type SearchExamplesOutputType = z.infer<typeof SearchExamplesOutput>;

/**
 * Truncate content to maximum lines
 * AC-3.4.5: Snippets truncated to 200 lines max
 */
const truncateSnippet = (content: string, maxLines: number = MAX_SNIPPET_LINES): string => {
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return content;
  }
  return lines.slice(0, maxLines).join('\n') + '\n... [truncated]';
};

/**
 * Generate alternative query suggestions based on the original query
 * AC-3.4.6: Empty results include suggested alternative queries
 */
const generateSuggestions = (query: string): string[] => {
  const suggestions: string[] = [];
  const queryLower = query.toLowerCase();

  for (const [domain, alternatives] of Object.entries(DOMAIN_SUGGESTIONS)) {
    if (queryLower.includes(domain)) {
      suggestions.push(...alternatives.filter((alt) => !queryLower.includes(alt.toLowerCase())));
    }
  }

  if (suggestions.length === 0) {
    return DEFAULT_SUGGESTIONS;
  }

  return suggestions.slice(0, 3);
};

/**
 * Convert SearchResult to PolicyExample
 * AC-3.4.4: Returns repo, path, snippet, description, tags, similarityScore
 * AC-3.4.5: Snippets truncated to 200 lines max
 */
const formatResult = (result: SearchResult): PolicyExample => ({
  repo: result.entry.repo,
  path: result.entry.path,
  snippet: truncateSnippet(result.entry.content),
  description: result.entry.description,
  tags: result.entry.tags,
  similarityScore: Math.round(result.similarityScore * 1000) / 1000,
});

/**
 * Execute the search_policy_examples tool
 * AC-3.4.3: Generates query embedding via OpenAI
 * AC-3.4.7: filterRepo filters to specific repository
 * AC-3.4.8: Tool invocations logged (query, not full results)
 */
export const executeSearchExamples = async (
  input: SearchExamplesInputType,
): Promise<SearchExamplesOutputType> => {
  const { query, limit = 3, filterRepo } = input;
  const logger = LoggerService.getLogger();

  // AC-3.4.8: Log search query (not full results)
  logger.info({ query, limit, filterRepo }, 'search_policy_examples invoked');

  try {
    // get services
    const vectorStore = VectorStore.getInstance();
    const stats = vectorStore.getStats();

    // check if vector store is initialized
    if (!stats.initialized || stats.count === 0) {
      logger.warn('VectorStore not initialized or empty');
      return {
        results: [],
        totalFound: 0,
        suggestions: [
          'Policy examples not yet indexed. Run "polyagent setup" to download and index policies.',
        ],
        error: {
          code: 'STORE_NOT_INITIALIZED',
          message: 'Policy example index is not available. Run setup to initialize.',
        },
      };
    }

    // AC-3.4.3: Generate query embedding via OpenAI
    const embeddingService = EmbeddingService.getInstance();
    if (!embeddingService.hasApiKey()) {
      logger.error('OpenAI API key not configured');
      return {
        results: [],
        totalFound: 0,
        error: {
          code: 'API_KEY_MISSING',
          message: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.',
        },
      };
    }

    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // AC-3.4.7: filterRepo filters to specific repository
    const searchResults = vectorStore.search(queryEmbedding, {
      limit,
      filterRepo,
      threshold: DEFAULT_SIMILARITY_THRESHOLD,
    });

    // AC-3.4.8: Log result count (not full results)
    logger.info({ resultCount: searchResults.length, query }, 'search_policy_examples completed');

    // AC-3.4.4 & AC-3.4.5: Format results with truncated snippets
    const results = searchResults.map(formatResult);

    // AC-3.4.6: Empty results include suggested alternative queries
    if (results.length === 0) {
      const suggestions = generateSuggestions(query);
      return {
        results: [],
        totalFound: 0,
        suggestions,
      };
    }

    return {
      results,
      totalFound: results.length,
    };
  } catch (error) {
    // AC-3.4.8: Log errors
    logger.error({ error, query }, 'search_policy_examples error');

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      results: [],
      totalFound: 0,
      error: {
        code: 'SEARCH_ERROR',
        message: errorMessage,
      },
    };
  }
};
