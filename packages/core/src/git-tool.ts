/**
 * @module git-tool
 *
 * AgentForge Git Integration Tool — provides agents with Git repository
 * awareness and management capabilities.
 *
 * Features:
 * - Auto-detect git repositories in workspace
 * - Show worktree status (clean/dirty/conflict)
 * - Quick branch switching
 * - Commit, diff, and log inspection
 * - Stash management
 *
 * @example
 * ```typescript
 * import { GitTool } from '@agentforge-ai/core/git-tool';
 *
 * const git = new GitTool({ basePath: '/workspace/my-project' });
 *
 * // Auto-detect repos
 * const repos = await git.detectRepositories();
 *
 * // Get status
 * const status = await git.getStatus();
 *
 * // Switch branch
 * await git.switchBranch('feature/new-thing');
 * ```
 */

import { execFileSync, type ExecFileSyncOptions } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// ─── Types ──────────────────────────────────────────────────────────────

export interface GitToolConfig {
  /** Base path to search for git repositories. */
  basePath: string;
  /** Maximum depth to search for .git directories. Defaults to 3. */
  maxSearchDepth?: number;
  /** Timeout for git commands in milliseconds. Defaults to 10000. */
  timeout?: number;
  /** Custom git binary path. Defaults to 'git'. */
  gitBinary?: string;
}

export interface GitRepository {
  /** Absolute path to the repository root. */
  path: string;
  /** Name of the repository (directory name). */
  name: string;
  /** Current branch name. */
  currentBranch: string;
  /** Whether the repository has uncommitted changes. */
  isDirty: boolean;
  /** Whether the repository has merge conflicts. */
  hasConflicts: boolean;
  /** Remote URL (origin). */
  remoteUrl: string | null;
}

export interface GitFileStatus {
  /** File path relative to repo root. */
  path: string;
  /** Index status character (A, M, D, R, C, U, ?). */
  indexStatus: string;
  /** Working tree status character. */
  workTreeStatus: string;
  /** Human-readable status description. */
  description: string;
}

export interface GitWorktreeStatus {
  /** Current branch name. */
  branch: string;
  /** Short commit hash of HEAD. */
  headCommit: string;
  /** Commit message of HEAD. */
  headMessage: string;
  /** Overall state: 'clean' | 'dirty' | 'conflict' | 'detached'. */
  state: 'clean' | 'dirty' | 'conflict' | 'detached';
  /** Number of commits ahead of upstream. */
  ahead: number;
  /** Number of commits behind upstream. */
  behind: number;
  /** List of changed files. */
  files: GitFileStatus[];
  /** Number of staged files. */
  staged: number;
  /** Number of modified (unstaged) files. */
  modified: number;
  /** Number of untracked files. */
  untracked: number;
  /** Number of conflicted files. */
  conflicted: number;
}

export interface GitLogEntry {
  /** Full commit hash. */
  hash: string;
  /** Short commit hash. */
  shortHash: string;
  /** Author name. */
  author: string;
  /** Author email. */
  email: string;
  /** Commit date as ISO string. */
  date: string;
  /** Commit message (first line). */
  message: string;
}

export interface GitBranch {
  /** Branch name. */
  name: string;
  /** Whether this is the current branch. */
  isCurrent: boolean;
  /** Whether this is a remote tracking branch. */
  isRemote: boolean;
  /** Upstream branch name, if any. */
  upstream: string | null;
  /** Last commit hash on this branch. */
  lastCommit: string;
}

export interface GitDiff {
  /** Files changed in the diff. */
  filesChanged: number;
  /** Lines added. */
  insertions: number;
  /** Lines deleted. */
  deletions: number;
  /** Raw diff output. */
  raw: string;
  /** Per-file diff summary. */
  files: Array<{
    path: string;
    insertions: number;
    deletions: number;
    status: string;
  }>;
}

export interface GitStashEntry {
  /** Stash index (0, 1, 2...). */
  index: number;
  /** Stash reference (stash@{0}). */
  ref: string;
  /** Branch the stash was created on. */
  branch: string;
  /** Stash message. */
  message: string;
}

// ─── GitTool Class ──────────────────────────────────────────────────────

export class GitTool {
  private readonly basePath: string;
  private readonly maxSearchDepth: number;
  private readonly timeout: number;
  private readonly gitBinary: string;
  private currentRepoPath: string | null = null;

  constructor(config: GitToolConfig) {
    this.basePath = resolve(config.basePath);
    this.maxSearchDepth = config.maxSearchDepth ?? 3;
    this.timeout = config.timeout ?? 10000;
    this.gitBinary = config.gitBinary ?? 'git';
  }

  // ─── Repository Detection ───────────────────────────────────────────

  /**
   * Auto-detect git repositories within the base path.
   * Searches recursively up to maxSearchDepth for .git directories.
   */
  detectRepositories(): GitRepository[] {
    const repos: GitRepository[] = [];
    this.searchForRepos(this.basePath, 0, repos);
    return repos;
  }

  private searchForRepos(dir: string, depth: number, repos: GitRepository[]): void {
    if (depth > this.maxSearchDepth) return;

    try {
      const gitDir = join(dir, '.git');
      if (existsSync(gitDir)) {
        try {
          const repo = this.inspectRepository(dir);
          repos.push(repo);
        } catch {
          // Skip repos we can't inspect
        }
        return; // Don't search inside a git repo for nested repos
      }

      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const fullPath = join(dir, entry);
        try {
          if (statSync(fullPath).isDirectory()) {
            this.searchForRepos(fullPath, depth + 1, repos);
          }
        } catch {
          // Skip inaccessible directories
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  private inspectRepository(repoPath: string): GitRepository {
    const name = repoPath.split('/').pop() || repoPath;
    const currentBranch = this.exec('rev-parse --abbrev-ref HEAD', repoPath).trim();
    const statusOutput = this.exec('status --porcelain', repoPath);
    const isDirty = statusOutput.trim().length > 0;
    const hasConflicts = statusOutput.split('\n').some(line =>
      line.startsWith('UU') || line.startsWith('AA') || line.startsWith('DD')
    );

    let remoteUrl: string | null = null;
    try {
      remoteUrl = this.exec('remote get-url origin', repoPath).trim() || null;
    } catch {
      remoteUrl = null;
    }

    return { path: repoPath, name, currentBranch, isDirty, hasConflicts, remoteUrl };
  }

  // ─── Worktree Status ───────────────────────────────────────────────

  /**
   * Get detailed worktree status for the current repository.
   * Shows branch, ahead/behind, file changes, and overall state.
   */
  getStatus(repoPath?: string): GitWorktreeStatus {
    const path = repoPath || this.currentRepoPath || this.basePath;

    const branch = this.exec('rev-parse --abbrev-ref HEAD', path).trim();
    const headCommit = this.exec('rev-parse --short HEAD', path).trim();
    const headMessage = this.exec('log -1 --format=%s', path).trim();

    // Parse ahead/behind
    let ahead = 0;
    let behind = 0;
    try {
      const abOutput = this.exec('rev-list --left-right --count HEAD...@{upstream}', path).trim();
      const parts = abOutput.split('\t');
      ahead = parseInt(parts[0], 10) || 0;
      behind = parseInt(parts[1], 10) || 0;
    } catch {
      // No upstream configured
    }

    // Parse file statuses
    const statusOutput = this.exec('status --porcelain=v1', path);
    const files: GitFileStatus[] = [];
    let staged = 0;
    let modified = 0;
    let untracked = 0;
    let conflicted = 0;

    for (const line of statusOutput.split('\n')) {
      if (!line.trim()) continue;

      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.substring(3);

      const description = this.describeFileStatus(indexStatus, workTreeStatus);
      files.push({ path: filePath, indexStatus, workTreeStatus, description });

      // Count categories
      if (indexStatus === 'U' || workTreeStatus === 'U' ||
          (indexStatus === 'A' && workTreeStatus === 'A') ||
          (indexStatus === 'D' && workTreeStatus === 'D')) {
        conflicted++;
      } else if (indexStatus === '?' && workTreeStatus === '?') {
        untracked++;
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') staged++;
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') modified++;
      }
    }

    // Determine overall state
    let state: GitWorktreeStatus['state'];
    if (branch === 'HEAD') {
      state = 'detached';
    } else if (conflicted > 0) {
      state = 'conflict';
    } else if (staged > 0 || modified > 0 || untracked > 0) {
      state = 'dirty';
    } else {
      state = 'clean';
    }

    return {
      branch, headCommit, headMessage, state,
      ahead, behind, files,
      staged, modified, untracked, conflicted,
    };
  }

  private describeFileStatus(index: string, workTree: string): string {
    const statusMap: Record<string, string> = {
      'A': 'added', 'M': 'modified', 'D': 'deleted',
      'R': 'renamed', 'C': 'copied', 'U': 'unmerged',
      '?': 'untracked', '!': 'ignored',
    };

    if (index === 'U' || workTree === 'U') return 'conflict';
    if (index === '?' && workTree === '?') return 'untracked';
    if (index === '!' && workTree === '!') return 'ignored';

    const parts: string[] = [];
    if (index !== ' ' && index !== '?') parts.push(`staged: ${statusMap[index] || index}`);
    if (workTree !== ' ' && workTree !== '?') parts.push(`unstaged: ${statusMap[workTree] || workTree}`);
    return parts.join(', ') || 'unknown';
  }

  // ─── Branch Management ──────────────────────────────────────────────

  /**
   * List all branches (local and remote).
   */
  listBranches(repoPath?: string): GitBranch[] {
    const path = repoPath || this.currentRepoPath || this.basePath;
    const output = this.exec(`branch -a --format='%(refname:short)|%(HEAD)|%(upstream:short)|%(objectname:short)'`, path);
    const branches: GitBranch[] = [];

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      const [name, head, upstream, lastCommit] = line.split('|');
      if (!name) continue;

      branches.push({
        name: name.trim(),
        isCurrent: head?.trim() === '*',
        isRemote: name.startsWith('origin/'),
        upstream: upstream?.trim() || null,
        lastCommit: lastCommit?.trim() || '',
      });
    }

    return branches;
  }

  /**
   * Switch to a branch. Creates the branch if it doesn't exist and create is true.
   */
  switchBranch(branchName: string, options?: { create?: boolean; repoPath?: string }): void {
    const path = options?.repoPath || this.currentRepoPath || this.basePath;

    if (options?.create) {
      this.exec(`checkout -b ${this.sanitize(branchName)}`, path);
    } else {
      this.exec(`checkout ${this.sanitize(branchName)}`, path);
    }
  }

  /**
   * Create a new branch from the current HEAD or a specific ref.
   */
  createBranch(branchName: string, options?: { from?: string; repoPath?: string }): void {
    const path = options?.repoPath || this.currentRepoPath || this.basePath;
    const from = options?.from ? ` ${this.sanitize(options.from)}` : '';
    this.exec(`branch ${this.sanitize(branchName)}${from}`, path);
  }

  /**
   * Delete a branch (local only).
   */
  deleteBranch(branchName: string, options?: { force?: boolean; repoPath?: string }): void {
    const path = options?.repoPath || this.currentRepoPath || this.basePath;
    const flag = options?.force ? '-D' : '-d';
    this.exec(`branch ${flag} ${this.sanitize(branchName)}`, path);
  }

  // ─── Commit Operations ──────────────────────────────────────────────

  /**
   * Stage files for commit.
   */
  stage(paths: string | string[], repoPath?: string): void {
    const path = repoPath || this.currentRepoPath || this.basePath;
    const files = Array.isArray(paths) ? paths.map(p => this.sanitize(p)).join(' ') : this.sanitize(paths);
    this.exec(`add ${files}`, path);
  }

  /**
   * Unstage files.
   */
  unstage(paths: string | string[], repoPath?: string): void {
    const path = repoPath || this.currentRepoPath || this.basePath;
    const files = Array.isArray(paths) ? paths.map(p => this.sanitize(p)).join(' ') : this.sanitize(paths);
    this.exec(`reset HEAD -- ${files}`, path);
  }

  /**
   * Create a commit with the given message.
   */
  commit(message: string, options?: { all?: boolean; amend?: boolean; repoPath?: string }): string {
    const path = options?.repoPath || this.currentRepoPath || this.basePath;
    const flags: string[] = [];
    if (options?.all) flags.push('-a');
    if (options?.amend) flags.push('--amend');

    this.exec(`commit ${flags.join(' ')} -m "${message.replace(/"/g, '\\"')}"`, path);
    return this.exec('rev-parse --short HEAD', path).trim();
  }

  // ─── Log & Diff ─────────────────────────────────────────────────────

  /**
   * Get commit log entries.
   */
  log(options?: { count?: number; branch?: string; repoPath?: string }): GitLogEntry[] {
    const path = options?.repoPath || this.currentRepoPath || this.basePath;
    const count = options?.count ?? 10;
    const branch = options?.branch ? ` ${this.sanitize(options.branch)}` : '';

    const format = '%H|%h|%an|%ae|%aI|%s';
    const output = this.exec(`log -${count}${branch} --format="${format}"`, path);
    const entries: GitLogEntry[] = [];

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      const [hash, shortHash, author, email, date, ...messageParts] = line.split('|');
      if (!hash) continue;
      entries.push({
        hash, shortHash, author, email, date,
        message: messageParts.join('|'),
      });
    }

    return entries;
  }

  /**
   * Get diff between working tree and HEAD (or between two refs).
   */
  diff(options?: { staged?: boolean; ref1?: string; ref2?: string; repoPath?: string }): GitDiff {
    const path = options?.repoPath || this.currentRepoPath || this.basePath;

    let diffCmd = 'diff';
    if (options?.staged) {
      diffCmd = 'diff --cached';
    } else if (options?.ref1 && options?.ref2) {
      diffCmd = `diff ${this.sanitize(options.ref1)}..${this.sanitize(options.ref2)}`;
    } else if (options?.ref1) {
      diffCmd = `diff ${this.sanitize(options.ref1)}`;
    }

    const raw = this.exec(diffCmd, path);

    // Get stat summary
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    const files: GitDiff['files'] = [];

    try {
      const statOutput = this.exec(`${diffCmd} --numstat`, path);
      for (const line of statOutput.split('\n')) {
        if (!line.trim()) continue;
        const [ins, del, filePath] = line.split('\t');
        if (!filePath) continue;
        const insNum = parseInt(ins, 10) || 0;
        const delNum = parseInt(del, 10) || 0;
        files.push({
          path: filePath,
          insertions: insNum,
          deletions: delNum,
          status: insNum > 0 && delNum > 0 ? 'modified' : insNum > 0 ? 'added' : 'deleted',
        });
        insertions += insNum;
        deletions += delNum;
        filesChanged++;
      }
    } catch {
      // Stat parsing failed, use raw diff
    }

    return { filesChanged, insertions, deletions, raw, files };
  }

  // ─── Stash Management ──────────────────────────────────────────────

  /**
   * List all stash entries.
   */
  listStashes(repoPath?: string): GitStashEntry[] {
    const path = repoPath || this.currentRepoPath || this.basePath;
    const output = this.exec(`stash list --format='%gd|%gs'`, path);
    const stashes: GitStashEntry[] = [];

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      const [ref, ...messageParts] = line.split('|');
      if (!ref) continue;

      const indexMatch = ref.match(/\{(\d+)\}/);
      const index = indexMatch ? parseInt(indexMatch[1], 10) : stashes.length;
      const fullMessage = messageParts.join('|');
      const branchMatch = fullMessage.match(/on (.+?):/);

      stashes.push({
        index,
        ref,
        branch: branchMatch?.[1] || 'unknown',
        message: fullMessage,
      });
    }

    return stashes;
  }

  /**
   * Create a new stash.
   */
  stash(message?: string, repoPath?: string): void {
    const path = repoPath || this.currentRepoPath || this.basePath;
    const msg = message ? ` -m "${message.replace(/"/g, '\\"')}"` : '';
    this.exec(`stash push${msg}`, path);
  }

  /**
   * Pop the most recent stash (or a specific one).
   */
  stashPop(index?: number, repoPath?: string): void {
    const path = repoPath || this.currentRepoPath || this.basePath;
    const ref = index !== undefined ? ` stash@{${index}}` : '';
    this.exec(`stash pop${ref}`, path);
  }

  /**
   * Drop a stash entry.
   */
  stashDrop(index?: number, repoPath?: string): void {
    const path = repoPath || this.currentRepoPath || this.basePath;
    const ref = index !== undefined ? ` stash@{${index}}` : '';
    this.exec(`stash drop${ref}`, path);
  }

  // ─── Remote Operations ──────────────────────────────────────────────

  /**
   * Fetch updates from remote.
   */
  fetch(remote?: string, repoPath?: string): void {
    const path = repoPath || this.currentRepoPath || this.basePath;
    this.exec(`fetch ${remote || '--all'}`, path);
  }

  /**
   * Pull changes from remote.
   */
  pull(options?: { remote?: string; branch?: string; rebase?: boolean; repoPath?: string }): void {
    const path = options?.repoPath || this.currentRepoPath || this.basePath;
    const flags: string[] = [];
    if (options?.rebase) flags.push('--rebase');
    const remote = options?.remote || 'origin';
    const branch = options?.branch || '';
    this.exec(`pull ${flags.join(' ')} ${remote} ${branch}`.trim(), path);
  }

  /**
   * Push changes to remote.
   */
  push(options?: { remote?: string; branch?: string; force?: boolean; setUpstream?: boolean; repoPath?: string }): void {
    const path = options?.repoPath || this.currentRepoPath || this.basePath;
    const flags: string[] = [];
    if (options?.force) flags.push('--force');
    if (options?.setUpstream) flags.push('--set-upstream');
    const remote = options?.remote || 'origin';
    const branch = options?.branch || '';
    this.exec(`push ${flags.join(' ')} ${remote} ${branch}`.trim(), path);
  }

  // ─── Utility ────────────────────────────────────────────────────────

  /**
   * Set the active repository for subsequent operations.
   */
  setRepository(repoPath: string): void {
    this.currentRepoPath = resolve(repoPath);
  }

  /**
   * Check if a path is inside a git repository.
   */
  isGitRepository(dirPath?: string): boolean {
    const path = dirPath || this.basePath;
    try {
      this.exec('rev-parse --is-inside-work-tree', path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the root directory of the git repository containing the given path.
   */
  getRepoRoot(dirPath?: string): string | null {
    const path = dirPath || this.basePath;
    try {
      return this.exec('rev-parse --show-toplevel', path).trim();
    } catch {
      return null;
    }
  }

  /**
   * Parse a command string into an array of arguments.
   * Handles quoted strings (both single and double quotes) and escaped quotes.
   */
  private parseArgs(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar: '"' | "'" | null = null;
    let i = 0;

    while (i < command.length) {
      const ch = command[i];
      const nextCh = command[i + 1];

      if (inQuote) {
        // Inside a quoted string
        if (ch === quoteChar) {
          if (nextCh === quoteChar) {
            // Escaped quote ("")
            current += ch;
            i += 2;
            continue;
          } else {
            // End of quoted string
            inQuote = false;
            quoteChar = null;
          }
        } else {
          current += ch;
        }
      } else {
        // Outside quotes
        if (ch === '"' || ch === "'") {
          inQuote = true;
          quoteChar = ch;
        } else if (ch === ' ') {
          if (current) {
            args.push(current);
            current = '';
          }
        } else {
          current += ch;
        }
      }
      i++;
    }

    // Add the last argument if present
    if (current) {
      args.push(current);
    }

    return args;
  }

  /**
   * Execute a raw git command and return stdout.
   */
  exec(command: string, cwd?: string): string {
    const args = this.parseArgs(command);
    const options: ExecFileSyncOptions = {
      cwd: cwd || this.currentRepoPath || this.basePath,
      timeout: this.timeout,
      encoding: 'utf-8' as BufferEncoding,
      // execFileSync doesn't use shell by default - safer!
    };

    try {
      return execFileSync(this.gitBinary, args, options) as string;
    } catch (error: unknown) {
      const err = error as { stderr?: string | Buffer; status?: number; message?: string };
      const stderr = err.stderr?.toString().trim() || err.message || 'Unknown git error';
      throw new GitToolError(`git ${command.split(' ')[0]} failed: ${stderr}`, command);
    }
  }

  /**
   * Sanitize a string for use in git commands (prevent injection).
   */
  private sanitize(input: string): string {
    // Only allow safe characters for branch names, file paths, and refs
    if (/[;&|`$(){}]/.test(input)) {
      throw new GitToolError(`Unsafe characters in input: ${input}`, 'sanitize');
    }
    return input;
  }
}

// ─── Error Class ────────────────────────────────────────────────────────

export class GitToolError extends Error {
  public readonly command: string;

  constructor(message: string, command: string) {
    super(message);
    this.name = 'GitToolError';
    this.command = command;
  }
}
