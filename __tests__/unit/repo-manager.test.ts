import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { RepoManager, CURATED_REPOS, PolicyIndexEntry } from '../../src/lib/repo-manager';

describe('RepoManager (Story 3.1)', () => {
  let testDir: string;
  let repoManager: RepoManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `polyagent-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    repoManager = new RepoManager(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('AC-3.1.1: System clones 5 curated repos on setup', () => {
    it('should have 5 curated repositories defined', () => {
      expect(CURATED_REPOS).toHaveLength(5);
    });

    it('should include Liatrio, Gatekeeper, Sigstore, Scalr, RedHat repos', () => {
      const repoNames = CURATED_REPOS.map(r => r.name.toLowerCase());
      expect(repoNames).toContain('liatrio');
      expect(repoNames).toContain('gatekeeper');
      expect(repoNames).toContain('sigstore');
      expect(repoNames).toContain('scalr');
      expect(repoNames).toContain('redhat');
    });

    it('should have valid URLs for all curated repos', () => {
      for (const repo of CURATED_REPOS) {
        expect(repo.url).toMatch(/^https:\/\/github\.com\//);
        expect(repo.url).toMatch(/\.git$/);
      }
    });

    it('should have all curated repos enabled by default', () => {
      for (const repo of CURATED_REPOS) {
        expect(repo.enabled).toBe(true);
      }
    });
  });

  describe('AC-3.1.2: Repos cached to ~/.polyagent/policy-examples/repos/', () => {
    it('should use correct base directory structure', () => {
      const reposDir = repoManager.getReposDir();
      expect(reposDir).toContain('repos');
    });

    it('should create repos directory if not exists', async () => {
      await repoManager.initialize();
      expect(existsSync(repoManager.getReposDir())).toBe(true);
    });
  });

  describe('AC-3.1.3: System scans repos for .rego files', () => {
    it('should scan directory for .rego files', async () => {
      // Create a test .rego file
      const policyDir = join(testDir, 'repos', 'test-repo', 'policies');
      mkdirSync(policyDir, { recursive: true });
      writeFileSync(
        join(policyDir, 'test.rego'),
        `# Test policy for RBAC
package authz

default allow := false

allow if {
  input.user.role == "admin"
}
`
      );

      const files = await repoManager.scanForRegoFiles(join(testDir, 'repos', 'test-repo'));
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('test.rego');
    });

    it('should ignore non-.rego files', async () => {
      const policyDir = join(testDir, 'repos', 'test-repo');
      mkdirSync(policyDir, { recursive: true });
      writeFileSync(join(policyDir, 'readme.md'), '# README');
      writeFileSync(join(policyDir, 'config.json'), '{}');
      writeFileSync(join(policyDir, 'policy.rego'), 'package test');

      const files = await repoManager.scanForRegoFiles(policyDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('policy.rego');
    });

    it('should recursively scan nested directories', async () => {
      const baseDir = join(testDir, 'repos', 'test-repo');
      mkdirSync(join(baseDir, 'level1', 'level2'), { recursive: true });
      writeFileSync(join(baseDir, 'root.rego'), 'package root');
      writeFileSync(join(baseDir, 'level1', 'middle.rego'), 'package middle');
      writeFileSync(join(baseDir, 'level1', 'level2', 'deep.rego'), 'package deep');

      const files = await repoManager.scanForRegoFiles(baseDir);
      expect(files).toHaveLength(3);
    });

    it('should skip hidden directories', async () => {
      const baseDir = join(testDir, 'repos', 'test-repo');
      mkdirSync(join(baseDir, '.hidden'), { recursive: true });
      writeFileSync(join(baseDir, '.hidden', 'secret.rego'), 'package secret');
      writeFileSync(join(baseDir, 'public.rego'), 'package public');

      const files = await repoManager.scanForRegoFiles(baseDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('public.rego');
    });
  });

  describe('AC-3.1.4: Metadata extracted', () => {
    it('should extract package name from Rego file', () => {
      const content = `package authz.rbac

default allow := false
`;
      const metadata = repoManager.extractMetadata(content, 'test.rego', 'test-repo');
      expect(metadata.packageName).toBe('authz.rbac');
    });

    it('should extract description from first comments', () => {
      const content = `# This is a test policy for RBAC
# It handles user authorization
package authz

default allow := false
`;
      const metadata = repoManager.extractMetadata(content, 'test.rego', 'test-repo');
      expect(metadata.description).toContain('test policy');
    });

    it('should generate tags from path and content', () => {
      const content = `package kubernetes.admission

deny if {
  input.request.kind.kind == "Pod"
}
`;
      const metadata = repoManager.extractMetadata(content, 'kubernetes/admission.rego', 'gatekeeper');
      expect(metadata.tags).toContain('kubernetes');
    });

    it('should include repo name in tags', () => {
      const content = 'package test';
      const metadata = repoManager.extractMetadata(content, 'test.rego', 'liatrio');
      expect(metadata.tags).toContain('liatrio');
    });

    it('should generate unique ID for each entry', () => {
      const content = 'package test';
      const metadata1 = repoManager.extractMetadata(content, 'a/test.rego', 'repo1');
      const metadata2 = repoManager.extractMetadata(content, 'b/test.rego', 'repo1');
      expect(metadata1.id).not.toBe(metadata2.id);
    });

    it('should handle empty comments gracefully', () => {
      const content = `package test

allow := true
`;
      const metadata = repoManager.extractMetadata(content, 'test.rego', 'test-repo');
      expect(metadata.description).toBeDefined();
      expect(metadata.description.length).toBeGreaterThan(0);
    });
  });

  describe('AC-3.1.5: Index stored in index.json', () => {
    it('should write index.json file', async () => {
      const entries: PolicyIndexEntry[] = [
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
      ];

      await repoManager.writeIndex(entries);
      const indexPath = join(testDir, 'index.json');
      expect(existsSync(indexPath)).toBe(true);
    });

    it('should read index.json file', async () => {
      const entries: PolicyIndexEntry[] = [
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
      ];

      await repoManager.writeIndex(entries);
      const loadedEntries = await repoManager.readIndex();
      expect(loadedEntries).toHaveLength(1);
      expect(loadedEntries[0].packageName).toBe('test');
    });

    it('should return empty array for non-existent index', async () => {
      const entries = await repoManager.readIndex();
      expect(entries).toEqual([]);
    });

    it('should preserve all metadata fields when round-tripping', async () => {
      const originalEntry: PolicyIndexEntry = {
        id: 'test-1',
        repo: 'test-repo',
        path: 'policies/test.rego',
        packageName: 'authz.rbac',
        description: 'Test RBAC policy',
        tags: ['test', 'rbac', 'authz'],
        content: 'package authz.rbac\n\ndefault allow := false',
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      await repoManager.writeIndex([originalEntry]);
      const [loadedEntry] = await repoManager.readIndex();

      expect(loadedEntry.id).toBe(originalEntry.id);
      expect(loadedEntry.repo).toBe(originalEntry.repo);
      expect(loadedEntry.path).toBe(originalEntry.path);
      expect(loadedEntry.packageName).toBe(originalEntry.packageName);
      expect(loadedEntry.description).toBe(originalEntry.description);
      expect(loadedEntry.tags).toEqual(originalEntry.tags);
      expect(loadedEntry.content).toBe(originalEntry.content);
      expect(loadedEntry.lastUpdated).toBe(originalEntry.lastUpdated);
    });
  });

  describe('AC-3.1.6: Repository updates supported via git pull', () => {
    it('should return error for non-existent repository', async () => {
      const result = await repoManager.updateRepository('non-existent-repo');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should attempt update on existing repository directory', async () => {
      // Create a fake repo directory (not a real git repo, so pull will fail)
      const repoPath = join(testDir, 'repos', 'test-update-repo');
      mkdirSync(repoPath, { recursive: true });

      const result = await repoManager.updateRepository('test-update-repo');
      // Will fail because it's not a real git repo, but should handle gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('AC-3.1.7: Custom repositories can be added', () => {
    it('should validate custom repository has name and URL', async () => {
      const result = await repoManager.addCustomRepository({ name: '', url: '', enabled: true });
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('AC-3.1.8: Clone failures handled gracefully', () => {
    it('should return error info for invalid repo config', async () => {
      const result = await repoManager.addCustomRepository({
        name: '',
        url: '',
        enabled: true,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return success for existing repository directory', async () => {
      // Create a fake repo directory
      const repoPath = join(testDir, 'repos', 'existing-repo');
      mkdirSync(repoPath, { recursive: true });

      const result = await repoManager.cloneRepository({
        name: 'existing-repo',
        url: 'https://example.com/repo.git',
        enabled: true,
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe(repoPath);
    });
  });
});
