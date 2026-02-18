import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GitTool, GitToolError } from './git-tool';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, realpathSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const RAW_TEST_DIR = join(tmpdir(), 'agentforge-git-test-' + Date.now());
mkdirSync(RAW_TEST_DIR, { recursive: true });
const TEST_DIR = realpathSync(RAW_TEST_DIR);
const REPO_DIR = join(TEST_DIR, 'test-repo');
const NESTED_REPO_DIR = join(TEST_DIR, 'projects', 'nested-repo');

function gitExec(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function createTestRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  gitExec('init', dir);
  gitExec('config user.email "test@agentforge.ai"', dir);
  gitExec('config user.name "Test User"', dir);
  writeFileSync(join(dir, 'README.md'), '# Test Repo\n');
  gitExec('add .', dir);
  gitExec('commit -m "Initial commit"', dir);
}

describe('GitTool', () => {
  let git: GitTool;

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    createTestRepo(REPO_DIR);
    createTestRepo(NESTED_REPO_DIR);
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Full reset: recreate the repo from scratch for perfect isolation
    try {
      rmSync(REPO_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
    createTestRepo(REPO_DIR);
    git = new GitTool({ basePath: REPO_DIR });
  });

  // ─── Repository Detection ──────────────────────────────────────────

  describe('detectRepositories', () => {
    it('should detect the test repository', () => {
      const searchGit = new GitTool({ basePath: TEST_DIR, maxSearchDepth: 5 });
      const repos = searchGit.detectRepositories();
      expect(repos.length).toBeGreaterThanOrEqual(2);
      const names = repos.map(r => r.name);
      expect(names).toContain('test-repo');
      expect(names).toContain('nested-repo');
    });

    it('should return correct repository info', () => {
      const searchGit = new GitTool({ basePath: TEST_DIR, maxSearchDepth: 5 });
      const repos = searchGit.detectRepositories();
      const testRepo = repos.find(r => r.name === 'test-repo');
      expect(testRepo).toBeDefined();
      expect(testRepo!.path).toBe(REPO_DIR);
      expect(testRepo!.isDirty).toBe(false);
      expect(testRepo!.hasConflicts).toBe(false);
      expect(testRepo!.currentBranch).toMatch(/^(main|master)$/);
    });

    it('should respect maxSearchDepth', () => {
      const shallowGit = new GitTool({ basePath: TEST_DIR, maxSearchDepth: 0 });
      const repos = shallowGit.detectRepositories();
      // At depth 0, it only checks TEST_DIR itself (which is not a repo)
      expect(repos.length).toBe(0);
    });

    it('should detect dirty repositories', () => {
      writeFileSync(join(REPO_DIR, 'dirty.txt'), 'dirty file');
      const searchGit = new GitTool({ basePath: TEST_DIR, maxSearchDepth: 5 });
      const repos = searchGit.detectRepositories();
      const testRepo = repos.find(r => r.name === 'test-repo');
      expect(testRepo!.isDirty).toBe(true);
    });
  });

  // ─── Worktree Status ──────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return clean status for clean repo', () => {
      const status = git.getStatus();
      expect(status.state).toBe('clean');
      expect(status.branch).toMatch(/^(main|master)$/);
      expect(status.files).toHaveLength(0);
      expect(status.staged).toBe(0);
      expect(status.modified).toBe(0);
      expect(status.untracked).toBe(0);
      expect(status.conflicted).toBe(0);
    });

    it('should detect untracked files', () => {
      writeFileSync(join(REPO_DIR, 'new-file.txt'), 'new content');
      const status = git.getStatus();
      expect(status.state).toBe('dirty');
      expect(status.untracked).toBe(1);
      expect(status.files.some(f => f.path === 'new-file.txt')).toBe(true);
    });

    it('should detect modified files', () => {
      writeFileSync(join(REPO_DIR, 'README.md'), '# Modified\n');
      const status = git.getStatus();
      expect(status.state).toBe('dirty');
      expect(status.modified).toBe(1);
    });

    it('should detect staged files', () => {
      writeFileSync(join(REPO_DIR, 'staged.txt'), 'staged content');
      gitExec('add staged.txt', REPO_DIR);
      const status = git.getStatus();
      expect(status.state).toBe('dirty');
      expect(status.staged).toBe(1);
    });

    it('should include HEAD commit info', () => {
      const status = git.getStatus();
      expect(status.headCommit).toBeTruthy();
      expect(status.headMessage).toBe('Initial commit');
    });
  });

  // ─── Branch Management ──────────────────────────────────────────────

  describe('listBranches', () => {
    it('should list the main branch', () => {
      const branches = git.listBranches();
      expect(branches.length).toBeGreaterThanOrEqual(1);
      const current = branches.find(b => b.isCurrent);
      expect(current).toBeDefined();
      expect(current!.name).toMatch(/^(main|master)$/);
    });
  });

  describe('switchBranch', () => {
    it('should create and switch to a new branch', () => {
      git.switchBranch('test-branch', { create: true });
      const status = git.getStatus();
      expect(status.branch).toBe('test-branch');
    });

    it('should switch to an existing branch', () => {
      gitExec('branch existing-branch', REPO_DIR);
      git.switchBranch('existing-branch');
      const status = git.getStatus();
      expect(status.branch).toBe('existing-branch');
    });

    it('should throw when switching to non-existent branch', () => {
      expect(() => git.switchBranch('nonexistent-branch')).toThrow(GitToolError);
    });
  });

  describe('createBranch', () => {
    it('should create a new branch', () => {
      git.createBranch('new-branch');
      const branches = git.listBranches();
      expect(branches.some(b => b.name === 'new-branch')).toBe(true);
    });
  });

  describe('deleteBranch', () => {
    it('should delete a branch', () => {
      gitExec('branch to-delete', REPO_DIR);
      git.deleteBranch('to-delete');
      const branches = git.listBranches();
      expect(branches.some(b => b.name === 'to-delete')).toBe(false);
    });
  });

  // ─── Commit Operations ──────────────────────────────────────────────

  describe('stage', () => {
    it('should stage a single file', () => {
      writeFileSync(join(REPO_DIR, 'to-stage.txt'), 'content');
      git.stage('to-stage.txt');
      const status = git.getStatus();
      expect(status.staged).toBe(1);
    });

    it('should stage multiple files', () => {
      writeFileSync(join(REPO_DIR, 'file1.txt'), 'content1');
      writeFileSync(join(REPO_DIR, 'file2.txt'), 'content2');
      git.stage(['file1.txt', 'file2.txt']);
      const status = git.getStatus();
      expect(status.staged).toBe(2);
    });
  });

  describe('unstage', () => {
    it('should unstage a file', () => {
      writeFileSync(join(REPO_DIR, 'unstage-me.txt'), 'content');
      gitExec('add unstage-me.txt', REPO_DIR);
      git.unstage('unstage-me.txt');
      const status = git.getStatus();
      expect(status.staged).toBe(0);
      expect(status.untracked).toBe(1);
    });
  });

  describe('commit', () => {
    it('should create a commit', () => {
      writeFileSync(join(REPO_DIR, 'commit-test.txt'), 'content');
      git.stage('commit-test.txt');
      const hash = git.commit('Test commit message');
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThanOrEqual(4);
    });

    it('should commit all with -a flag', () => {
      writeFileSync(join(REPO_DIR, 'README.md'), '# Modified for commit\n');
      const hash = git.commit('Commit all changes', { all: true });
      expect(hash).toBeTruthy();
      const status = git.getStatus();
      expect(status.state).toBe('clean');
    });
  });

  // ─── Log & Diff ─────────────────────────────────────────────────────

  describe('log', () => {
    it('should return commit log', () => {
      const entries = git.log({ count: 5 });
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].author).toBe('Test User');
      expect(entries[0].email).toBe('test@agentforge.ai');
      expect(entries[0].hash).toBeTruthy();
      expect(entries[0].shortHash).toBeTruthy();
    });

    it('should respect count limit', () => {
      // Create extra commits
      writeFileSync(join(REPO_DIR, 'log1.txt'), 'log1');
      gitExec('add log1.txt', REPO_DIR);
      gitExec('commit -m "Log commit 1"', REPO_DIR);
      writeFileSync(join(REPO_DIR, 'log2.txt'), 'log2');
      gitExec('add log2.txt', REPO_DIR);
      gitExec('commit -m "Log commit 2"', REPO_DIR);

      const entries = git.log({ count: 1 });
      expect(entries.length).toBe(1);
      expect(entries[0].message).toBe('Log commit 2');
    });
  });

  describe('diff', () => {
    it('should return empty diff for clean repo', () => {
      const d = git.diff();
      expect(d.filesChanged).toBe(0);
      expect(d.insertions).toBe(0);
      expect(d.deletions).toBe(0);
    });

    it('should detect file changes in diff', () => {
      writeFileSync(join(REPO_DIR, 'README.md'), '# Modified for diff\nNew line\n');
      const d = git.diff();
      expect(d.filesChanged).toBeGreaterThanOrEqual(1);
      expect(d.raw).toContain('Modified for diff');
    });

    it('should show staged diff', () => {
      writeFileSync(join(REPO_DIR, 'staged-diff.txt'), 'staged content');
      gitExec('add staged-diff.txt', REPO_DIR);
      const d = git.diff({ staged: true });
      expect(d.filesChanged).toBe(1);
      expect(d.files[0].path).toBe('staged-diff.txt');
    });
  });

  // ─── Stash Management ──────────────────────────────────────────────

  describe('stash', () => {
    it('should stash changes', () => {
      writeFileSync(join(REPO_DIR, 'README.md'), '# Stash me\n');
      git.stash('Test stash');
      const status = git.getStatus();
      expect(status.state).toBe('clean');
    });

    it('should list stashes', () => {
      writeFileSync(join(REPO_DIR, 'README.md'), '# Stash list test\n');
      git.stash('List test stash');
      const stashes = git.listStashes();
      expect(stashes.length).toBeGreaterThanOrEqual(1);
      expect(stashes[0].message).toContain('List test stash');
    });

    it('should pop stash', () => {
      writeFileSync(join(REPO_DIR, 'README.md'), '# Pop stash test\n');
      git.stash('Pop test stash');
      expect(git.getStatus().state).toBe('clean');
      git.stashPop();
      expect(git.getStatus().state).toBe('dirty');
    });
  });

  // ─── Utility ────────────────────────────────────────────────────────

  describe('isGitRepository', () => {
    it('should return true for git repo', () => {
      expect(git.isGitRepository()).toBe(true);
    });

    it('should return false for non-git directory', () => {
      expect(git.isGitRepository(TEST_DIR)).toBe(false);
    });
  });

  describe('getRepoRoot', () => {
    it('should return repo root', () => {
      const root = git.getRepoRoot();
      expect(root).toBe(REPO_DIR);
    });

    it('should return null for non-git directory', () => {
      const root = git.getRepoRoot(TEST_DIR);
      expect(root).toBeNull();
    });
  });

  describe('setRepository', () => {
    it('should set the active repository', () => {
      const multiGit = new GitTool({ basePath: TEST_DIR });
      multiGit.setRepository(NESTED_REPO_DIR);
      const status = multiGit.getStatus();
      expect(status.branch).toMatch(/^(main|master)$/);
    });
  });

  // ─── Security ──────────────────────────────────────────────────────

  describe('sanitize', () => {
    it('should reject unsafe characters', () => {
      expect(() => git.switchBranch('branch; rm -rf /')).toThrow(GitToolError);
      expect(() => git.switchBranch('branch | cat /etc/passwd')).toThrow(GitToolError);
      expect(() => git.switchBranch('branch$(whoami)')).toThrow(GitToolError);
      expect(() => git.switchBranch('branch`id`')).toThrow(GitToolError);
    });

    it('should allow safe branch names', () => {
      git.switchBranch('safe-branch-name', { create: true });
      expect(git.getStatus().branch).toBe('safe-branch-name');
    });

    it('should allow branch names with slashes', () => {
      git.switchBranch('feature/my-feature', { create: true });
      expect(git.getStatus().branch).toBe('feature/my-feature');
    });
  });
});
