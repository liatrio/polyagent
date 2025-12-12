/**
 * Repository Manager for Policy Examples
 *
 * Downloads, caches, and indexes curated policy repositories for RAG search.
 * Story 3.1: Policy Repository Downloader & Indexer
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { simpleGit } from 'simple-git';

/** Simple debug logger - can be replaced with proper logger later */
const debug = (msg: string) => {
  if (process.env.DEBUG) {
    console.log(`[repo-manager] ${msg}`);
  }
};

/**
 * Curated repository definition
 */
export interface CuratedRepo {
  name: string;
  url: string;
  enabled: boolean;
  branch?: string;
}

/**
 * Policy index entry for search
 */
export interface PolicyIndexEntry {
  id: string;
  repo: string;
  path: string;
  packageName: string;
  description: string;
  tags: string[];
  content: string;
  lastUpdated: string;
}

/**
 * Clone operation result
 */
export interface CloneResult {
  success: boolean;
  repo: string;
  path?: string;
  error?: string;
}

/**
 * Bulk clone operation result
 */
export interface CloneAllResult {
  cloned: number;
  failed: number;
  total: number;
  results: CloneResult[];
}

/**
 * Curated policy repositories
 * AC-3.1.1: System clones 5 curated repos (Liatrio, Gatekeeper, Sigstore, Scalr, RedHat)
 */
export const CURATED_REPOS: CuratedRepo[] = [
  {
    name: 'liatrio',
    url: 'https://github.com/liatrio/opa-policies.git',
    enabled: true,
  },
  {
    name: 'gatekeeper',
    url: 'https://github.com/open-policy-agent/gatekeeper-library.git',
    enabled: true,
  },
  {
    name: 'sigstore',
    url: 'https://github.com/sigstore/policy-controller.git',
    enabled: true,
  },
  {
    name: 'scalr',
    url: 'https://github.com/Scalr/sample-tf-opa-policies.git',
    enabled: true,
  },
  {
    name: 'redhat',
    url: 'https://github.com/redhat-cop/opa-rego-classes.git',
    enabled: true,
  },
];

/**
 * Repository Manager
 *
 * Handles cloning, caching, and indexing of policy repositories.
 */
export class RepoManager {
  private baseDir: string;
  private reposDir: string;
  private indexPath: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.reposDir = join(baseDir, 'repos');
    this.indexPath = join(baseDir, 'index.json');
  }

  /**
   * Get the repos directory path
   * AC-3.1.2: Repos cached to ~/.polyagent/policy-examples/repos/
   */
  getReposDir(): string {
    return this.reposDir;
  }

  /**
   * Initialize the repository manager
   * Creates necessary directories if they don't exist
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
    if (!existsSync(this.reposDir)) {
      mkdirSync(this.reposDir, { recursive: true });
    }
    debug(`RepoManager initialized at ${this.baseDir}`);
  }

  /**
   * Clone all curated repositories
   * AC-3.1.1: System clones 5 curated repos on setup
   */
  async cloneRepositories(): Promise<CloneAllResult> {
    await this.initialize();

    const results: CloneResult[] = [];
    let cloned = 0;
    let failed = 0;

    for (const repo of CURATED_REPOS) {
      if (!repo.enabled) {
        continue;
      }

      const result = await this.cloneRepository(repo);
      results.push(result);

      if (result.success) {
        cloned++;
      } else {
        failed++;
      }
    }

    return {
      cloned,
      failed,
      total: CURATED_REPOS.length,
      results,
    };
  }

  /**
   * Clone a single repository
   * AC-3.1.8: Clone failures handled gracefully with error messages
   */
  async cloneRepository(repo: CuratedRepo): Promise<CloneResult> {
    const repoPath = join(this.reposDir, repo.name);

    try {
      // Check if already cloned
      if (existsSync(repoPath)) {
        debug(`Repository ${repo.name} already exists at ${repoPath}`);
        return {
          success: true,
          repo: repo.name,
          path: repoPath,
        };
      }

      // Clone the repository
      const git = simpleGit();
      await git.clone(repo.url, repoPath, repo.branch ? ['--branch', repo.branch] : []);

      debug(`Cloned ${repo.name} to ${repoPath}`);
      return {
        success: true,
        repo: repo.name,
        path: repoPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug(`Failed to clone ${repo.name}: ${errorMessage}`);
      return {
        success: false,
        repo: repo.name,
        error: errorMessage,
      };
    }
  }

  /**
   * Update a repository via git pull
   * AC-3.1.6: Repository updates supported via git pull
   */
  async updateRepository(repoName: string): Promise<CloneResult> {
    const repoPath = join(this.reposDir, repoName);

    try {
      if (!existsSync(repoPath)) {
        return {
          success: false,
          repo: repoName,
          error: `Repository ${repoName} not found at ${repoPath}`,
        };
      }

      const git = simpleGit(repoPath);
      const pullResult = await git.pull();

      debug(`Updated ${repoName}: ${pullResult.summary.changes} changes`);
      return {
        success: true,
        repo: repoName,
        path: repoPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug(`Failed to update ${repoName}: ${errorMessage}`);
      return {
        success: false,
        repo: repoName,
        error: errorMessage,
      };
    }
  }

  /**
   * Scan a directory for .rego files
   * AC-3.1.3: System scans repos for .rego files
   */
  async scanForRegoFiles(dir: string): Promise<string[]> {
    const regoFiles: string[] = [];

    async function scan(currentDir: string): Promise<void> {
      try {
        const entries = await readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(currentDir, entry.name);

          if (entry.isDirectory()) {
            // Skip hidden directories and common non-policy directories
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await scan(fullPath);
            }
          } else if (entry.isFile() && entry.name.endsWith('.rego')) {
            regoFiles.push(fullPath);
          }
        }
      } catch (error) {
        debug(`Error scanning ${currentDir}: ${error}`);
      }
    }

    await scan(dir);
    return regoFiles;
  }

  /**
   * Extract metadata from a Rego file
   * AC-3.1.4: Metadata extracted: file path, package name, description, tags
   */
  extractMetadata(content: string, filePath: string, repoName: string): PolicyIndexEntry {
    // Extract package name
    const packageMatch = content.match(/^package\s+([a-zA-Z0-9_.]+)/m);
    const packageName = packageMatch ? packageMatch[1] : 'unknown';

    // Extract description from leading comments
    const lines = content.split('\n');
    const descriptionLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        descriptionLines.push(trimmed.substring(1).trim());
      } else if (trimmed.startsWith('package')) {
        break;
      } else if (trimmed === '') {
        continue;
      } else {
        break;
      }
    }
    const description = descriptionLines.join(' ').trim() || `Policy from ${repoName}`;

    // Generate tags from path and content
    const tags = this.generateTags(content, filePath, repoName);

    // Generate unique ID
    const id = `${repoName}-${filePath.replace(/[/\\]/g, '-').replace('.rego', '')}`;

    return {
      id,
      repo: repoName,
      path: filePath,
      packageName,
      description,
      tags,
      content,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Generate tags from content and path
   */
  private generateTags(content: string, filePath: string, repoName: string): string[] {
    const tags = new Set<string>();

    // Add repo name as tag
    tags.add(repoName.toLowerCase());

    // Extract tags from path
    const pathParts = filePath.toLowerCase().split(/[/\\]/);
    for (const part of pathParts) {
      if (part && !part.endsWith('.rego') && part.length > 2) {
        tags.add(part);
      }
    }

    // Common OPA/Rego keywords to detect
    const keywords = [
      'kubernetes',
      'k8s',
      'admission',
      'pod',
      'container',
      'rbac',
      'authorization',
      'authz',
      'authentication',
      'authn',
      'terraform',
      'aws',
      'gcp',
      'azure',
      'security',
      'compliance',
      'deny',
      'allow',
      'ingress',
      'egress',
      'network',
      'policy',
    ];

    const lowerContent = content.toLowerCase();
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        tags.add(keyword);
      }
    }

    return Array.from(tags);
  }

  /**
   * Write the policy index to disk
   * AC-3.1.5: Index stored in index.json
   */
  async writeIndex(entries: PolicyIndexEntry[]): Promise<void> {
    const indexData = {
      version: '1.0',
      generated: new Date().toISOString(),
      count: entries.length,
      entries,
    };

    writeFileSync(this.indexPath, JSON.stringify(indexData, null, 2));
    debug(`Wrote index with ${entries.length} entries to ${this.indexPath}`);
  }

  /**
   * Read the policy index from disk
   * AC-3.1.5: Index stored in index.json
   */
  async readIndex(): Promise<PolicyIndexEntry[]> {
    if (!existsSync(this.indexPath)) {
      return [];
    }

    try {
      const data = readFileSync(this.indexPath, 'utf-8');
      const index = JSON.parse(data);
      return index.entries || [];
    } catch (error) {
      debug(`Failed to read index: ${error}`);
      return [];
    }
  }

  /**
   * Build the full index from all repositories
   */
  async buildIndex(): Promise<PolicyIndexEntry[]> {
    await this.initialize();

    const entries: PolicyIndexEntry[] = [];

    for (const repo of CURATED_REPOS) {
      if (!repo.enabled) {
        continue;
      }

      const repoPath = join(this.reposDir, repo.name);
      if (!existsSync(repoPath)) {
        debug(`Repository ${repo.name} not found, skipping`);
        continue;
      }

      const regoFiles = await this.scanForRegoFiles(repoPath);
      debug(`Found ${regoFiles.length} .rego files in ${repo.name}`);

      for (const filePath of regoFiles) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const relativePath = filePath.substring(repoPath.length + 1);
          const metadata = this.extractMetadata(content, relativePath, repo.name);
          entries.push(metadata);
        } catch (error) {
          debug(`Failed to process ${filePath}: ${error}`);
        }
      }
    }

    await this.writeIndex(entries);
    return entries;
  }

  /**
   * Get the current commit hash for a repository
   */
  async getRepoCommit(repoName: string): Promise<string | null> {
    const repoPath = join(this.reposDir, repoName);

    try {
      if (!existsSync(repoPath)) {
        return null;
      }

      const git = simpleGit(repoPath);
      const commit = await git.revparse(['HEAD']);
      return commit.trim();
    } catch (error) {
      debug(`Failed to get commit for ${repoName}: ${error}`);
      return null;
    }
  }

  /**
   * Add a custom repository
   * AC-3.1.7: Custom repositories can be added via config
   */
  async addCustomRepository(repo: CuratedRepo): Promise<CloneResult> {
    // Validate the repo config
    if (!repo.name || !repo.url) {
      return {
        success: false,
        repo: repo.name || 'unknown',
        error: 'Repository name and URL are required',
      };
    }

    return this.cloneRepository(repo);
  }
}
