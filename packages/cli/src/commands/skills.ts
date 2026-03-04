import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, success, error, info, dim, warn, colors, formatDate, details, truncate } from '../lib/display.js';
import fs from 'fs-extra';
import path from 'node:path';
import readline from 'node:readline';
import { execSync } from 'node:child_process';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillManifest {
  name: string;
  description: string;
  version: string;
  tags?: string[];
  author?: string;
  repository?: string;
}

interface RegistryEntry {
  name: string;
  description: string;
  version: string;
  tags: string[];
  author: string;
  source: 'builtin' | 'github' | 'local' | 'url';
  repository?: string;
  path?: string;
}

interface SkillLockEntry {
  name: string;
  version: string;
  source: string;
  installedAt: string;
  repository?: string;
}

interface SkillsLock {
  version: 1;
  skills: Record<string, SkillLockEntry>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SKILLS_DIR_NAME = 'skills';
const SKILLS_LOCK_FILE = 'skills.lock.json';
const WORKSPACE_DIR_NAME = 'workspace';

// ─── Built-in Skills Registry ─────────────────────────────────────────────────
// These are the skills that ship with AgentForge and can be installed via CLI.
// They follow the Mastra Agent Skills Specification (SKILL.md frontmatter format).

const BUILTIN_REGISTRY: RegistryEntry[] = [
  {
    name: 'web-search',
    description: 'Search the web for information using DuckDuckGo. Provides structured search results with titles, URLs, and snippets.',
    version: '1.0.0',
    tags: ['web', 'search', 'research'],
    author: 'AgentForge',
    source: 'builtin',
  },
  {
    name: 'file-manager',
    description: 'Advanced file management operations including batch rename, find-and-replace across files, directory comparison, and file organization.',
    version: '1.0.0',
    tags: ['files', 'utility', 'management'],
    author: 'AgentForge',
    source: 'builtin',
  },
  {
    name: 'code-review',
    description: 'Systematic code review following best practices. Checks for bugs, security vulnerabilities, style issues, and suggests improvements.',
    version: '1.0.0',
    tags: ['development', 'review', 'quality'],
    author: 'AgentForge',
    source: 'builtin',
  },
  {
    name: 'data-analyst',
    description: 'Analyze CSV, JSON, and tabular data. Generate summaries, statistics, and insights from structured datasets.',
    version: '1.0.0',
    tags: ['data', 'analysis', 'csv', 'json'],
    author: 'AgentForge',
    source: 'builtin',
  },
  {
    name: 'api-tester',
    description: 'Test REST APIs with structured request/response validation. Supports GET, POST, PUT, DELETE with headers and body.',
    version: '1.0.0',
    tags: ['api', 'testing', 'http', 'rest'],
    author: 'AgentForge',
    source: 'builtin',
  },
  {
    name: 'git-workflow',
    description: 'Git workflow automation including conventional commits, branch management, PR descriptions, and changelog generation.',
    version: '1.0.0',
    tags: ['git', 'workflow', 'development'],
    author: 'AgentForge',
    source: 'builtin',
  },
  {
    name: 'browser-automation',
    description: 'Browser automation using Playwright. Navigate web pages, click elements, type text, extract content, take screenshots, and run JavaScript. Supports Docker sandbox mode for secure execution.',
    version: '1.0.0',
    tags: ['web', 'browser', 'automation', 'scraping'],
    author: 'AgentForge',
    source: 'builtin',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

/**
 * Resolve the project's skills directory.
 * Checks for workspace/skills/ first (Mastra Workspace pattern), then falls back to skills/.
 */
function resolveSkillsDir(): string {
  const cwd = process.cwd();

  // Mastra Workspace pattern: workspace/skills/
  const workspaceSkillsDir = path.join(cwd, WORKSPACE_DIR_NAME, SKILLS_DIR_NAME);
  if (fs.existsSync(workspaceSkillsDir)) {
    return workspaceSkillsDir;
  }

  // Fallback: skills/ at project root
  return path.join(cwd, SKILLS_DIR_NAME);
}

/**
 * Read the skills lockfile for tracking installed skills.
 */
function readSkillsLock(skillsDir: string): SkillsLock {
  const lockPath = path.join(path.dirname(skillsDir), SKILLS_LOCK_FILE);
  if (fs.existsSync(lockPath)) {
    try {
      return JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    } catch {
      // Corrupted lock file, start fresh
    }
  }
  return { version: 1, skills: {} };
}

/**
 * Write the skills lockfile.
 */
function writeSkillsLock(skillsDir: string, lock: SkillsLock): void {
  const lockPath = path.join(path.dirname(skillsDir), SKILLS_LOCK_FILE);
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

/**
 * Parse SKILL.md frontmatter to extract metadata.
 * Uses a simple YAML frontmatter parser to avoid heavy dependencies.
 */
function parseSkillMd(content: string): { data: SkillManifest; content: string } {
  // Dynamic import of gray-matter for YAML frontmatter parsing
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const matter = require('gray-matter');
    const parsed = matter(content);
    return {
      data: parsed.data as SkillManifest,
      content: parsed.content,
    };
  } catch {
    // Fallback: simple regex-based frontmatter parsing
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) {
      return { data: { name: '', description: '', version: '1.0.0' }, content };
    }

    const frontmatter = fmMatch[1];
    const body = fmMatch[2];
    const data: Record<string, unknown> = {};

    for (const line of frontmatter.split('\n')) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const value = match[2].trim();
        data[match[1]] = value;
      }
    }

    return {
      data: data as unknown as SkillManifest,
      content: body,
    };
  }
}

/**
 * Read a local skill's metadata from its SKILL.md.
 */
function readSkillMetadata(skillDir: string): SkillManifest | null {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) return null;

  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const { data } = parseSkillMd(content);
  return {
    name: data.name || path.basename(skillDir),
    description: data.description || '',
    version: data.version || '1.0.0',
    tags: data.tags || [],
    author: data.author || 'Unknown',
  };
}

/**
 * Find a skill in the built-in registry by name.
 */
function findInRegistry(name: string): RegistryEntry | undefined {
  return BUILTIN_REGISTRY.find((s) => s.name === name);
}

// ─── Built-in Skill Content Generators ────────────────────────────────────────
// These generate the full SKILL.md + supporting files for each built-in skill.

function generateBuiltinSkill(name: string): Map<string, string> | null {
  const generators: Record<string, () => Map<string, string>> = {
    'web-search': generateWebSearchSkill,
    'file-manager': generateFileManagerSkill,
    'code-review': generateCodeReviewSkill,
    'data-analyst': generateDataAnalystSkill,
    'api-tester': generateApiTesterSkill,
    'git-workflow': generateGitWorkflowSkill,
    'browser-automation': generateBrowserAutomationSkill,
  };

  const generator = generators[name];
  return generator ? generator() : null;
}

function generateWebSearchSkill(): Map<string, string> {
  const files = new Map<string, string>();

  files.set('SKILL.md', `---
name: web-search
description: Search the web for information using DuckDuckGo and return structured results
version: 1.0.0
tags:
  - web
  - search
  - research
---

# Web Search

You are a web research assistant. When the user asks you to search for information:

1. Use the workspace sandbox to execute the search script at \`scripts/search.ts\`
2. Parse the results and present them in a clear, organized format
3. Include source URLs for all information
4. Summarize key findings at the top

## How to Search

Run the search script with the user's query:

\`\`\`bash
npx tsx scripts/search.ts "user query here"
\`\`\`

The script returns JSON with structured results including title, URL, and snippet.

## Result Format

Present results as:
- **Title** — Brief description ([Source](url))
- Group related results together
- Highlight the most relevant findings first

## Guidelines

- Always cite sources with URLs
- If results are insufficient, suggest refined queries
- Cross-reference multiple results for accuracy
- Note when information may be outdated
`);

  files.set('scripts/search.ts', `#!/usr/bin/env npx tsx
/**
 * Web Search Script — Uses DuckDuckGo Instant Answer API
 *
 * Usage: npx tsx scripts/search.ts "your query"
 */

const query = process.argv[2];
if (!query) {
  console.error('Usage: npx tsx scripts/search.ts "query"');
  process.exit(1);
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function search(q: string): Promise<SearchResult[]> {
  const url = \`https://api.duckduckgo.com/?q=\${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1\`;
  const res = await fetch(url);
  const data = await res.json();

  const results: SearchResult[] = [];

  // Abstract (main answer)
  if (data.Abstract) {
    results.push({
      title: data.Heading || q,
      url: data.AbstractURL || '',
      snippet: data.Abstract,
    });
  }

  // Related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 80),
          url: topic.FirstURL,
          snippet: topic.Text,
        });
      }
      // Subtopics
      if (topic.Topics) {
        for (const sub of topic.Topics) {
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: sub.Text.split(' - ')[0] || sub.Text.slice(0, 80),
              url: sub.FirstURL,
              snippet: sub.Text,
            });
          }
        }
      }
    }
  }

  return results.slice(0, 10);
}

search(query)
  .then((results) => console.log(JSON.stringify({ query, results, count: results.length }, null, 2)))
  .catch((err) => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
`);

  files.set('references/search-tips.md', `# Search Tips

## Effective Queries
- Use specific keywords rather than full sentences
- Include domain-specific terms for technical searches
- Use quotes for exact phrase matching (in the query string)
- Add "site:example.com" to limit to specific domains

## Result Evaluation
- Check the date of sources when available
- Cross-reference claims across multiple results
- Prefer authoritative sources (.edu, .gov, established publications)
- Note when results are from forums vs. official documentation
`);

  return files;
}

function generateFileManagerSkill(): Map<string, string> {
  const files = new Map<string, string>();

  files.set('SKILL.md', `---
name: file-manager
description: Advanced file management operations including batch rename, find-and-replace, and directory organization
version: 1.0.0
tags:
  - files
  - utility
  - management
---

# File Manager

You are a file management assistant. Help users organize, search, and manipulate files in the workspace.

## Capabilities

1. **List & Search** — Find files by name, extension, or content
2. **Batch Rename** — Rename multiple files using patterns
3. **Find & Replace** — Search and replace text across files
4. **Organize** — Sort files into directories by type, date, or custom rules
5. **Compare** — Show differences between files or directories

## How to Use

Use the workspace filesystem tools to perform operations:

- \`mastra_workspace_list_files\` — List directory contents as a tree
- \`mastra_workspace_read_file\` — Read file contents
- \`mastra_workspace_write_file\` — Create or overwrite files
- \`mastra_workspace_edit_file\` — Find and replace in files
- \`mastra_workspace_delete\` — Remove files or directories
- \`mastra_workspace_file_stat\` — Get file metadata (size, dates)
- \`mastra_workspace_mkdir\` — Create directories

For complex operations, use \`mastra_workspace_execute_command\` with the scripts in this skill.

## Scripts

- \`scripts/batch-rename.ts\` — Batch rename files with pattern support
- \`scripts/find-replace.ts\` — Find and replace across multiple files
- \`scripts/organize.ts\` — Organize files by extension into directories

## Guidelines

- Always confirm destructive operations (delete, overwrite) with the user
- Show a preview of changes before executing batch operations
- Create backups when performing bulk modifications
- Report the number of files affected after each operation
`);

  files.set('scripts/batch-rename.ts', `#!/usr/bin/env npx tsx
/**
 * Batch Rename Script
 *
 * Usage: npx tsx scripts/batch-rename.ts <directory> <find-pattern> <replace-pattern>
 * Example: npx tsx scripts/batch-rename.ts ./docs "report-" "2026-report-"
 */

import { readdirSync, renameSync } from 'fs';
import { join, basename } from 'path';

const [dir, findPattern, replacePattern] = process.argv.slice(2);
if (!dir || !findPattern || !replacePattern) {
  console.error('Usage: npx tsx scripts/batch-rename.ts <dir> <find> <replace>');
  process.exit(1);
}

const files = readdirSync(dir);
const renames: Array<{ from: string; to: string }> = [];

for (const file of files) {
  if (file.includes(findPattern)) {
    const newName = file.replace(findPattern, replacePattern);
    renames.push({ from: file, to: newName });
  }
}

if (renames.length === 0) {
  console.log(JSON.stringify({ message: 'No files matched the pattern', count: 0 }));
  process.exit(0);
}

for (const { from, to } of renames) {
  renameSync(join(dir, from), join(dir, to));
}

console.log(JSON.stringify({ renames, count: renames.length }));
`);

  files.set('scripts/find-replace.ts', `#!/usr/bin/env npx tsx
/**
 * Find and Replace Script
 *
 * Usage: npx tsx scripts/find-replace.ts <directory> <find-text> <replace-text> [--ext .ts,.js]
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const args = process.argv.slice(2);
const dir = args[0];
const findText = args[1];
const replaceText = args[2];
const extFilter = args.includes('--ext') ? args[args.indexOf('--ext') + 1]?.split(',') : null;

if (!dir || !findText || replaceText === undefined) {
  console.error('Usage: npx tsx scripts/find-replace.ts <dir> <find> <replace> [--ext .ts,.js]');
  process.exit(1);
}

interface Change { file: string; count: number; }
const changes: Change[] = [];

function processDir(dirPath: string) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      processDir(fullPath);
    } else if (stat.isFile()) {
      if (extFilter && !extFilter.includes(extname(entry))) continue;
      const content = readFileSync(fullPath, 'utf-8');
      const count = (content.match(new RegExp(findText.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'g')) || []).length;
      if (count > 0) {
        const newContent = content.replaceAll(findText, replaceText);
        writeFileSync(fullPath, newContent);
        changes.push({ file: fullPath, count });
      }
    }
  }
}

processDir(dir);
console.log(JSON.stringify({ changes, totalFiles: changes.length, totalReplacements: changes.reduce((s, c) => s + c.count, 0) }));
`);

  return files;
}

function generateCodeReviewSkill(): Map<string, string> {
  const files = new Map<string, string>();

  files.set('SKILL.md', `---
name: code-review
description: Systematic code review following best practices for quality, security, and style
version: 1.0.0
tags:
  - development
  - review
  - quality
---

# Code Review

You are a code reviewer. When reviewing code, follow this systematic process:

## Review Process

1. **Critical Issues** — Security vulnerabilities, memory leaks, logic bugs, missing error handling
2. **Code Quality** — Functions over 50 lines, code duplication, confusing names, missing types
3. **Style Guide** — Check references/style-guide.md for naming and organization conventions
4. **Performance** — Unnecessary re-renders, N+1 queries, missing memoization, large bundle imports
5. **Testing** — Missing test coverage, edge cases not handled, brittle assertions

## Feedback Format

Provide feedback in this structure:

**Summary**: One sentence overview of the code quality

**Critical Issues**: List with file paths and line numbers
- \`file.ts:42\` — Description of the issue

**Suggestions**: Improvements that would help
- Description of suggestion with code example

**Positive Notes**: What the code does well

## What to Look Out For

- Unused variables and imports
- Missing error handling (try/catch, null checks)
- Security vulnerabilities (SQL injection, XSS, secrets in code)
- Performance issues (unnecessary loops, missing indexes)
- TypeScript: any types, missing return types, loose generics
- React: missing keys, stale closures, missing deps in useEffect

## Scripts

- \`scripts/lint.ts\` — Run linting checks on a file or directory
`);

  files.set('references/style-guide.md', `# Code Style Guide

## TypeScript Conventions
- Use \`const\` by default, \`let\` only when reassignment is needed
- Prefer \`interface\` over \`type\` for object shapes
- Always specify return types for exported functions
- Use \`unknown\` instead of \`any\` where possible
- Prefer \`readonly\` for properties that shouldn't change

## Naming Conventions
- **Files**: kebab-case (\`my-component.tsx\`)
- **Components**: PascalCase (\`MyComponent\`)
- **Functions**: camelCase (\`getUserById\`)
- **Constants**: UPPER_SNAKE_CASE (\`MAX_RETRIES\`)
- **Types/Interfaces**: PascalCase (\`UserProfile\`)

## File Organization
- One component per file
- Co-locate tests with source files (\`*.test.ts\`)
- Group by feature, not by type
- Keep files under 300 lines

## Error Handling
- Always handle promise rejections
- Use typed errors with error codes
- Log errors with context (user ID, request ID)
- Never swallow errors silently
`);

  files.set('scripts/lint.ts', `#!/usr/bin/env npx tsx
/**
 * Simple Lint Script — Checks for common issues
 *
 * Usage: npx tsx scripts/lint.ts <file-or-directory>
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: npx tsx scripts/lint.ts <file-or-directory>');
  process.exit(1);
}

interface LintIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning';
  message: string;
}

const issues: LintIssue[] = [];

function lintFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\\n');

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    // Check for console.log
    if (line.includes('console.log') && !filePath.includes('test')) {
      issues.push({ file: filePath, line: lineNum, severity: 'warning', message: 'console.log found — remove before production' });
    }
    // Check for debugger
    if (line.trim() === 'debugger' || line.trim() === 'debugger;') {
      issues.push({ file: filePath, line: lineNum, severity: 'error', message: 'debugger statement found' });
    }
    // Check for any type
    if (line.includes(': any') || line.includes('<any>')) {
      issues.push({ file: filePath, line: lineNum, severity: 'warning', message: 'Use of "any" type — prefer "unknown" or specific type' });
    }
    // Check for var usage
    if (/\\bvar\\s+/.test(line)) {
      issues.push({ file: filePath, line: lineNum, severity: 'error', message: 'Use "const" or "let" instead of "var"' });
    }
    // Check for TODO/FIXME
    if (/\\/\\/\\s*(TODO|FIXME|HACK|XXX)/.test(line)) {
      issues.push({ file: filePath, line: lineNum, severity: 'warning', message: 'Unresolved TODO/FIXME comment' });
    }
  });
}

function processPath(p: string) {
  const stat = statSync(p);
  if (stat.isFile() && ['.ts', '.tsx', '.js', '.jsx'].includes(extname(p))) {
    lintFile(p);
  } else if (stat.isDirectory()) {
    for (const entry of readdirSync(p)) {
      if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
        processPath(join(p, entry));
      }
    }
  }
}

processPath(target);
console.log(JSON.stringify({ issues, total: issues.length, errors: issues.filter(i => i.severity === 'error').length, warnings: issues.filter(i => i.severity === 'warning').length }));
`);

  return files;
}

function generateDataAnalystSkill(): Map<string, string> {
  const files = new Map<string, string>();

  files.set('SKILL.md', `---
name: data-analyst
description: Analyze CSV, JSON, and tabular data to generate summaries, statistics, and insights
version: 1.0.0
tags:
  - data
  - analysis
  - csv
  - json
---

# Data Analyst

You are a data analysis assistant. Help users understand and extract insights from structured data.

## Capabilities

1. **Load Data** — Read CSV, JSON, and TSV files from the workspace
2. **Summarize** — Generate column statistics (min, max, mean, median, mode)
3. **Filter & Query** — Filter rows by conditions, select columns
4. **Aggregate** — Group by columns and compute aggregates
5. **Detect Anomalies** — Find outliers and missing values

## How to Analyze

1. First, read the data file using workspace filesystem tools
2. Use \`scripts/analyze.ts\` for statistical analysis
3. Present findings in a clear table format
4. Suggest follow-up analyses based on initial findings

## Scripts

- \`scripts/analyze.ts\` — Compute statistics on CSV/JSON data

## Output Format

Present analysis results as:
- **Dataset Overview**: Row count, column count, column types
- **Key Statistics**: Per-column min, max, mean, median
- **Missing Data**: Columns with null/empty values and their percentages
- **Insights**: Notable patterns, correlations, or anomalies

## Guidelines

- Always show a sample of the data (first 5 rows) before analysis
- Handle missing values gracefully — report them, don't crash
- Use appropriate precision for numbers (2 decimal places for percentages)
- Suggest visualizations when patterns would be clearer in chart form
`);

  files.set('scripts/analyze.ts', `#!/usr/bin/env npx tsx
/**
 * Data Analysis Script — Basic statistics for CSV/JSON data
 *
 * Usage: npx tsx scripts/analyze.ts <file.csv|file.json>
 */

import { readFileSync } from 'fs';
import { extname } from 'path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/analyze.ts <file.csv|file.json>');
  process.exit(1);
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

const content = readFileSync(filePath, 'utf-8');
const ext = extname(filePath).toLowerCase();
let data: Record<string, string>[];

if (ext === '.json') {
  const parsed = JSON.parse(content);
  data = Array.isArray(parsed) ? parsed : [parsed];
} else {
  data = parseCSV(content);
}

const columns = Object.keys(data[0] || {});
const stats: Record<string, any> = {};

for (const col of columns) {
  const values = data.map(row => row[col]).filter(v => v !== '' && v !== null && v !== undefined);
  const numValues = values.map(Number).filter(n => !isNaN(n));

  stats[col] = {
    total: data.length,
    nonNull: values.length,
    missing: data.length - values.length,
    missingPct: ((data.length - values.length) / data.length * 100).toFixed(1) + '%',
    unique: new Set(values).size,
  };

  if (numValues.length > 0) {
    numValues.sort((a, b) => a - b);
    stats[col].type = 'numeric';
    stats[col].min = Math.min(...numValues);
    stats[col].max = Math.max(...numValues);
    stats[col].mean = +(numValues.reduce((s, n) => s + n, 0) / numValues.length).toFixed(2);
    stats[col].median = numValues.length % 2 === 0
      ? +((numValues[numValues.length / 2 - 1] + numValues[numValues.length / 2]) / 2).toFixed(2)
      : numValues[Math.floor(numValues.length / 2)];
  } else {
    stats[col].type = 'string';
    stats[col].sample = values.slice(0, 3);
  }
}

console.log(JSON.stringify({
  rows: data.length,
  columns: columns.length,
  columnNames: columns,
  stats,
  sample: data.slice(0, 5),
}, null, 2));
`);

  return files;
}

function generateApiTesterSkill(): Map<string, string> {
  const files = new Map<string, string>();

  files.set('SKILL.md', `---
name: api-tester
description: Test REST APIs with structured request/response validation
version: 1.0.0
tags:
  - api
  - testing
  - http
  - rest
---

# API Tester

You are an API testing assistant. Help users test and validate REST API endpoints.

## Capabilities

1. **Send Requests** — GET, POST, PUT, PATCH, DELETE with headers and body
2. **Validate Responses** — Check status codes, response structure, and timing
3. **Chain Requests** — Use output from one request as input to another
4. **Generate Reports** — Summarize test results with pass/fail status

## How to Test

Use \`scripts/request.ts\` to make HTTP requests:

\`\`\`bash
npx tsx scripts/request.ts GET https://api.example.com/users
npx tsx scripts/request.ts POST https://api.example.com/users --body '{"name":"test"}'
\`\`\`

## Report Format

For each API test, report:
- **Endpoint**: METHOD URL
- **Status**: HTTP status code (with pass/fail indicator)
- **Response Time**: Duration in milliseconds
- **Response Body**: Formatted JSON (truncated if large)
- **Headers**: Key response headers

## Guidelines

- Always show the full request details (method, URL, headers, body)
- Time every request and flag slow responses (>2s)
- Validate JSON response structure when a schema is provided
- Never send real credentials — use placeholders and warn the user
- Group related tests together (e.g., CRUD operations on one resource)
`);

  files.set('scripts/request.ts', `#!/usr/bin/env npx tsx
/**
 * HTTP Request Script — Make API requests from the command line
 *
 * Usage: npx tsx scripts/request.ts <METHOD> <URL> [--header "Key: Value"] [--body '{"key":"value"}']
 */

const args = process.argv.slice(2);
const method = args[0]?.toUpperCase() || 'GET';
const url = args[1];

if (!url) {
  console.error('Usage: npx tsx scripts/request.ts <METHOD> <URL> [--header "K: V"] [--body JSON]');
  process.exit(1);
}

const headers: Record<string, string> = { 'Content-Type': 'application/json' };
let body: string | undefined;

for (let i = 2; i < args.length; i++) {
  if (args[i] === '--header' && args[i + 1]) {
    const [key, ...valueParts] = args[++i].split(':');
    headers[key.trim()] = valueParts.join(':').trim();
  }
  if (args[i] === '--body' && args[i + 1]) {
    body = args[++i];
  }
}

async function makeRequest() {
  const start = Date.now();
  const res = await fetch(url, {
    method,
    headers,
    ...(body && method !== 'GET' ? { body } : {}),
  });
  const elapsed = Date.now() - start;
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { responseHeaders[k] = v; });

  let responseBody: any;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    responseBody = await res.json();
  } else {
    responseBody = await res.text();
  }

  console.log(JSON.stringify({
    request: { method, url, headers, body: body ? JSON.parse(body) : undefined },
    response: {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: responseBody,
      timeMs: elapsed,
    },
  }, null, 2));
}

makeRequest().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
`);

  return files;
}

function generateGitWorkflowSkill(): Map<string, string> {
  const files = new Map<string, string>();

  files.set('SKILL.md', `---
name: git-workflow
description: Git workflow automation including conventional commits, branch management, and changelog generation
version: 1.0.0
tags:
  - git
  - workflow
  - development
---

# Git Workflow

You are a Git workflow assistant. Help users follow best practices for version control.

## Capabilities

1. **Conventional Commits** — Generate commit messages following the Conventional Commits spec
2. **Branch Management** — Create, switch, and clean up branches following naming conventions
3. **PR Descriptions** — Generate pull request descriptions from commit history
4. **Changelog** — Generate changelogs from commit history

## Conventional Commit Format

\`\`\`
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
\`\`\`

### Types
- \`feat\`: New feature (MINOR version bump)
- \`fix\`: Bug fix (PATCH version bump)
- \`docs\`: Documentation changes
- \`style\`: Code style changes (formatting, semicolons)
- \`refactor\`: Code refactoring (no feature/fix)
- \`perf\`: Performance improvements
- \`test\`: Adding or updating tests
- \`chore\`: Build process, tooling, dependencies

## Branch Naming

- \`feat/<ticket>-<description>\` — New features
- \`fix/<ticket>-<description>\` — Bug fixes
- \`chore/<description>\` — Maintenance tasks
- \`release/<version>\` — Release branches

## Scripts

- \`scripts/changelog.ts\` — Generate changelog from git log

## Guidelines

- One logical change per commit
- Write commit messages in imperative mood ("Add feature" not "Added feature")
- Reference issue/ticket numbers in commits
- Keep PR descriptions focused on the "what" and "why"
- Squash fix-up commits before merging
`);

  files.set('references/commit-examples.md', `# Commit Message Examples

## Good Examples
\`\`\`
feat(auth): add OAuth2 login with Google provider
fix(api): handle null response from payment gateway
docs(readme): add deployment instructions for Cloudflare
refactor(db): extract query builder into separate module
perf(search): add index on user_email column
test(auth): add integration tests for JWT refresh flow
chore(deps): upgrade @mastra/core to 1.4.0
\`\`\`

## Bad Examples
\`\`\`
fixed stuff
update
WIP
asdf
changes
\`\`\`
`);

  files.set('scripts/changelog.ts', `#!/usr/bin/env npx tsx
/**
 * Changelog Generator — Generate changelog from git log
 *
 * Usage: npx tsx scripts/changelog.ts [--since v1.0.0] [--until HEAD]
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
let since = '';
let until = 'HEAD';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--since' && args[i + 1]) since = args[++i];
  if (args[i] === '--until' && args[i + 1]) until = args[++i];
}

const range = since ? \`\${since}..\${until}\` : until;
const log = execSync(\`git log \${range} --pretty=format:"%H|%s|%an|%ai" 2>/dev/null || echo ""\`, { encoding: 'utf-8' });

interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
  type: string;
  scope: string;
  description: string;
}

const commits: Commit[] = log.trim().split('\\n').filter(Boolean).map(line => {
  const [hash, message, author, date] = line.split('|');
  const match = message.match(/^(\\w+)(?:\\(([^)]+)\\))?:\\s*(.+)$/);
  return {
    hash: hash.slice(0, 7),
    message,
    author,
    date: date.split(' ')[0],
    type: match?.[1] || 'other',
    scope: match?.[2] || '',
    description: match?.[3] || message,
  };
});

const grouped: Record<string, Commit[]> = {};
for (const c of commits) {
  if (!grouped[c.type]) grouped[c.type] = [];
  grouped[c.type].push(c);
}

const typeLabels: Record<string, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  refactor: 'Refactoring',
  perf: 'Performance',
  test: 'Tests',
  chore: 'Chores',
};

let changelog = '# Changelog\\n\\n';
for (const [type, label] of Object.entries(typeLabels)) {
  if (grouped[type]?.length) {
    changelog += \`## \${label}\\n\\n\`;
    for (const c of grouped[type]) {
      const scope = c.scope ? \`**\${c.scope}**: \` : '';
      changelog += \`- \${scope}\${c.description} (\${c.hash})\\n\`;
    }
    changelog += '\\n';
  }
}

console.log(JSON.stringify({ changelog, totalCommits: commits.length, types: Object.keys(grouped) }));
`);

  return files;
}

function generateBrowserAutomationSkill(): Map<string, string> {
  const files = new Map<string, string>();

  files.set('SKILL.md', `---
name: browser-automation
description: Browser automation using Playwright. Navigate web pages, interact with elements, extract content, take screenshots, and run JavaScript.
version: 1.0.0
tags:
  - web
  - browser
  - automation
  - scraping
---

# Browser Automation

You are a browser automation assistant. Help users interact with web pages programmatically.

## Capabilities

1. **Navigate** — Go to any URL and wait for the page to load
2. **Click** — Click elements by CSS selector
3. **Type** — Fill text into input fields
4. **Screenshot** — Capture the current page as an image
5. **Extract Text** — Get readable text content from pages or specific elements
6. **Snapshot** — Get the accessibility tree for understanding page structure
7. **Evaluate** — Run arbitrary JavaScript on the page
8. **Wait** — Wait for elements to appear or for a specific duration
9. **Scroll** — Scroll the page up or down
10. **Select** — Choose options from dropdown menus
11. **Hover** — Hover over elements to trigger menus or tooltips
12. **Navigation** — Go back, forward, or reload the page

## How to Use

### Setup

\`\`\`typescript
import { createBrowserTool, MCPServer } from '@agentforge-ai/core';

const server = new MCPServer({ name: 'my-tools' });
const { tool, shutdown } = createBrowserTool({ headless: true });
server.registerTool(tool);
\`\`\`

### Docker Sandbox Mode

For secure, isolated execution:

\`\`\`typescript
const { tool, shutdown } = createBrowserTool({
  sandboxMode: true,
  headless: true,
});
\`\`\`

## Agent Instructions

1. Navigate to the target URL first
2. Wait for key elements before interacting
3. Use snapshot to understand page structure
4. Use extractText to get readable content
5. Use click and type for form interactions
6. Take screenshots for visual verification
7. Always close sessions when done

## Guidelines

- Prefer \`#id\` selectors over class-based selectors
- Use \`wait\` before clicking or typing on dynamic pages
- Use \`extractText\` with a selector for specific content
- Take screenshots before and after critical actions
- Close sessions to free resources
`);

  files.set('references/selectors.md', `# CSS Selector Guide for Browser Automation

## Recommended Selectors (most to least reliable)

1. \`#id\` — Element with a specific ID
2. \`[data-testid="value"]\` — Test ID attributes
3. \`[aria-label="value"]\` — Accessibility labels
4. \`button:has-text("Click me")\` — Playwright text selectors
5. \`.class-name\` — CSS class selectors
6. \`tag.class\` — Tag + class combination

## Examples

\`\`\`
#login-button           → Click the login button
input[name="email"]      → Type into email field
.nav-menu a:first-child → Click first nav link
form button[type=submit] → Submit a form
\`\`\`

## Tips

- Avoid fragile selectors like \`div > div > span:nth-child(3)\`
- Use Playwright's text selectors: \`text=Submit\`
- For dynamic content, wait for the element first
- Use \`snapshot\` action to discover available selectors
`);

  files.set('scripts/scrape.ts', `#!/usr/bin/env npx tsx
/**
 * Example: Scrape a web page and extract its text content
 *
 * Usage: npx tsx scripts/scrape.ts <url>
 */

const url = process.argv[2];
if (!url) {
  console.error('Usage: npx tsx scripts/scrape.ts <url>');
  process.exit(1);
}

console.log(JSON.stringify({
  instruction: 'Use the browser tool to scrape this URL',
  url,
  steps: [
    { action: 'navigate', url },
    { action: 'wait', timeMs: 2000 },
    { action: 'extractText' },
    { action: 'screenshot', fullPage: true },
    { action: 'close' },
  ],
}));
`);

  return files;
}

// ─── Command Registration ─────────────────────────────────────────────────────

export function registerSkillsCommand(program: Command) {
  const skills = program.command('skills').description('Manage agent skills (Mastra Workspace Skills)');

  // ─── skills list ──────────────────────────────────────────────────
  skills
    .command('list')
    .option('--json', 'Output as JSON')
    .option('--registry', 'Show available skills from the registry')
    .description('List installed skills or browse the registry')
    .action(async (opts) => {
      if (opts.registry) {
        // Show the built-in registry
        header('AgentForge Skills Registry');
        if (opts.json) {
          console.log(JSON.stringify(BUILTIN_REGISTRY, null, 2));
          return;
        }
        table(BUILTIN_REGISTRY.map((s) => ({
          Name: s.name,
          Description: truncate(s.description, 60),
          Version: s.version,
          Tags: s.tags.join(', '),
        })));
        info(`Install with: ${colors.cyan}agentforge skills install <name>${colors.reset}`);
        return;
      }

      // Show installed skills
      const skillsDir = resolveSkillsDir();
      header('Installed Skills');

      if (!fs.existsSync(skillsDir)) {
        info('No skills directory found. Install a skill with:');
        dim(`  agentforge skills install <name>`);
        dim(`  agentforge skills list --registry   # browse available skills`);
        return;
      }

      const dirs = fs.readdirSync(skillsDir).filter((d: string) => {
        const fullPath = path.join(skillsDir, d);
        return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'SKILL.md'));
      });

      if (dirs.length === 0) {
        info('No skills installed. Browse available skills with:');
        dim(`  agentforge skills list --registry`);
        return;
      }

      const lock = readSkillsLock(skillsDir);

      const skillData = dirs.map((d: string) => {
        const meta = readSkillMetadata(path.join(skillsDir, d));
        const lockEntry = lock.skills[d];
        return {
          Name: meta?.name || d,
          Description: truncate(meta?.description || '', 50),
          Version: meta?.version || '?',
          Tags: (meta?.tags || []).join(', '),
          Source: lockEntry?.source || 'local',
          Installed: lockEntry?.installedAt ? new Date(lockEntry.installedAt).toLocaleDateString() : '—',
        };
      });

      if (opts.json) {
        console.log(JSON.stringify(skillData, null, 2));
        return;
      }

      table(skillData);
      dim(`  Skills directory: ${skillsDir}`);
      info('Skills are auto-discovered by the Mastra Workspace.');
    });

  // ─── skills install ───────────────────────────────────────────────
  skills
    .command('install')
    .argument('<name>', 'Skill name from registry, GitHub URL, or local path')
    .option('--from <source>', 'Source: registry (default), github, local', 'registry')
    .description('Install a skill into the workspace')
    .action(async (name, opts) => {
      const skillsDir = resolveSkillsDir();
      const targetDir = path.join(skillsDir, name.split('/').pop()!.replace(/\.git$/, ''));

      // Check if already installed
      if (fs.existsSync(targetDir) && fs.existsSync(path.join(targetDir, 'SKILL.md'))) {
        warn(`Skill "${name}" is already installed at ${targetDir}`);
        const overwrite = await prompt('Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
          info('Installation cancelled.');
          return;
        }
        fs.removeSync(targetDir);
      }

      // Ensure skills directory exists
      fs.mkdirSync(skillsDir, { recursive: true });

      let source: string = opts.from;
      let installedName = name;

      if (opts.from === 'local' || fs.existsSync(name)) {
        // ─── Install from local path ─────────────────────────────
        source = 'local';
        const sourcePath = path.resolve(name);
        if (!fs.existsSync(sourcePath)) {
          error(`Local path not found: ${sourcePath}`);
          process.exit(1);
        }
        if (!fs.existsSync(path.join(sourcePath, 'SKILL.md'))) {
          error(`No SKILL.md found in ${sourcePath}. Not a valid skill directory.`);
          process.exit(1);
        }
        installedName = path.basename(sourcePath);
        const dest = path.join(skillsDir, installedName);
        fs.copySync(sourcePath, dest);
        success(`Skill "${installedName}" installed from local path.`);

      } else if (opts.from === 'github' || name.includes('github.com') || name.includes('/')) {
        // ─── Install from GitHub ─────────────────────────────────
        source = 'github';
        const repoUrl = name.includes('github.com') ? name : `https://github.com/${name}`;
        installedName = name.split('/').pop()!.replace(/\.git$/, '');
        const dest = path.join(skillsDir, installedName);

        info(`Cloning skill from ${repoUrl}...`);
        try {
          execSync(`git clone --depth 1 ${repoUrl} ${dest} 2>&1`, { encoding: 'utf-8' });
          // Remove .git directory
          fs.removeSync(path.join(dest, '.git'));

          if (!fs.existsSync(path.join(dest, 'SKILL.md'))) {
            error(`Cloned repo does not contain a SKILL.md. Not a valid skill.`);
            fs.removeSync(dest);
            process.exit(1);
          }
          success(`Skill "${installedName}" installed from GitHub.`);
        } catch (err: unknown) {
          error(`Failed to clone: ${(err as Error).message}`);
          process.exit(1);
        }

      } else {
        // ─── Install from built-in registry ──────────────────────
        source = 'builtin';
        const entry = findInRegistry(name);
        if (!entry) {
          error(`Skill "${name}" not found in the registry.`);
          info('Available skills:');
          BUILTIN_REGISTRY.forEach((s) => {
            dim(`  ${colors.cyan}${s.name}${colors.reset} — ${s.description}`);
          });
          info(`\nOr install from GitHub: ${colors.cyan}agentforge skills install owner/repo --from github${colors.reset}`);
          process.exit(1);
        }

        installedName = entry.name;
        const files = generateBuiltinSkill(entry.name);
        if (!files) {
          error(`No content generator for skill "${entry.name}".`);
          process.exit(1);
        }

        const dest = path.join(skillsDir, installedName);
        fs.mkdirSync(dest, { recursive: true });

        for (const [filePath, content] of files) {
          const fullPath = path.join(dest, filePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content);
        }

        success(`Skill "${installedName}" installed from AgentForge registry.`);
      }

      // Update lockfile
      const lock = readSkillsLock(skillsDir);
      const meta = readSkillMetadata(path.join(skillsDir, installedName));
      lock.skills[installedName] = {
        name: installedName,
        version: meta?.version || '1.0.0',
        source,
        installedAt: new Date().toISOString(),
      };
      writeSkillsLock(skillsDir, lock);

      // Show skill info
      if (meta) {
        console.log();
        details({
          Name: meta.name,
          Description: meta.description,
          Version: meta.version,
          Tags: (meta.tags || []).join(', ') || '—',
          Path: path.join(skillsDir, installedName),
        });
      }

      info('The skill is now available to agents via the Mastra Workspace.');
      dim('  Skills in the workspace/skills/ directory are auto-discovered.');

      // Sync to Convex if available (best-effort)
      try {
        const client = await createClient();
        await safeCall(
          () => client.mutation('skills:create' as any, {
            name: installedName,
            displayName: meta?.name || installedName,
            description: meta?.description || '',
            category: (meta?.tags || [])[0] || 'custom',
            version: meta?.version || '1.0.0',
            author: meta?.author || 'Unknown',
            code: `// Skill: ${installedName}\n// This skill uses the Agent Skills Specification (SKILL.md format)\n// See: workspace/skills/${installedName}/SKILL.md`,
          }),
          'Failed to sync skill to Convex'
        );
        dim('  Skill synced to Convex database.');
      } catch {
        // Convex not available — that's fine, skills work locally via filesystem
        dim('  Convex not connected — skill installed locally only.');
      }
    });

  // ─── skills remove ────────────────────────────────────────────────
  skills
    .command('remove')
    .argument('<name>', 'Skill name to remove')
    .option('--force', 'Skip confirmation prompt', false)
    .description('Remove an installed skill')
    .action(async (name, opts) => {
      const skillsDir = resolveSkillsDir();
      const skillDir = path.join(skillsDir, name);

      if (!fs.existsSync(skillDir)) {
        error(`Skill "${name}" not found in ${skillsDir}`);
        info('List installed skills with: agentforge skills list');
        process.exit(1);
      }

      if (!opts.force) {
        const confirm = await prompt(`Remove skill "${name}" and delete all files? (y/N): `);
        if (confirm.toLowerCase() !== 'y') {
          info('Removal cancelled.');
          return;
        }
      }

      // Remove from filesystem
      fs.removeSync(skillDir);
      success(`Skill "${name}" removed from disk.`);

      // Remove from lockfile
      const lock = readSkillsLock(skillsDir);
      delete lock.skills[name];
      writeSkillsLock(skillsDir, lock);

      // Remove from Convex (best-effort)
      try {
        const client = await createClient();
        const skills = await client.query('skills:list' as any, {});
        const skill = (skills as any[]).find((s: any) => s.name === name);
        if (skill) {
          await client.mutation('skills:remove' as any, { id: skill._id });
          dim('  Skill removed from Convex database.');
        }
      } catch {
        // Convex not available — that's fine
      }

      info('Skill removed. Agents will no longer discover it.');
    });

  // ─── skills search ────────────────────────────────────────────────
  skills
    .command('search')
    .argument('<query>', 'Search query')
    .description('Search for skills in the registry')
    .action(async (query) => {
      header('Skill Search Results');
      const q = query.toLowerCase();
      const matches = BUILTIN_REGISTRY.filter(
        (e) =>
          e.name.includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.tags.some((t) => t.includes(q))
      );

      if (matches.length === 0) {
        info(`No skills matching "${query}".`);
        info('Browse all skills: agentforge skills list --registry');
        return;
      }

      table(matches.map((e) => ({
        Name: e.name,
        Description: truncate(e.description, 60),
        Tags: e.tags.join(', '),
        Version: e.version,
      })));
      info(`Install with: ${colors.cyan}agentforge skills install <name>${colors.reset}`);
    });

  // ─── skills create ────────────────────────────────────────────────
  skills
    .command('create')
    .description('Create a new skill (interactive)')
    .option('--name <name>', 'Skill name (kebab-case)')
    .option('--description <desc>', 'Skill description')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (opts) => {
      const name = opts.name || await prompt('Skill name (kebab-case): ');
      const description = opts.description || await prompt('Description: ');
      const tagsInput = opts.tags || await prompt('Tags (comma-separated, e.g. web,search): ');
      const tags = tagsInput ? tagsInput.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

      if (!name) { error('Skill name is required.'); process.exit(1); }
      if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        error('Skill name must be kebab-case (lowercase letters, numbers, hyphens).');
        process.exit(1);
      }

      const skillsDir = resolveSkillsDir();
      const skillDir = path.join(skillsDir, name);

      if (fs.existsSync(skillDir)) {
        error(`Skill "${name}" already exists at ${skillDir}`);
        process.exit(1);
      }

      // Create skill directory structure
      fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
      fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });

      // Assets directory for images and other files
      fs.mkdirSync(path.join(skillDir, 'assets'), { recursive: true });

      // SKILL.md (Agent Skills Specification format)
      const tagsYaml = tags.length > 0
        ? `tags:\n${tags.map((t: string) => `  - ${t}`).join('\n')}`
        : 'tags: []';

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: ${name}
description: ${description}
version: 1.0.0
${tagsYaml}
---

# ${name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

${description}

## Instructions

<!-- Add instructions for how the agent should use this skill -->

1. Step one
2. Step two
3. Step three

## References

See \`references/\` for supporting documentation.

## Scripts

See \`scripts/\` for executable scripts the agent can run.

## Guidelines

- Guideline one
- Guideline two
`);

      // Placeholder reference
      fs.writeFileSync(path.join(skillDir, 'references', 'README.md'),
        `# References for ${name}\n\nAdd supporting documentation here.\n`);

      // Placeholder script
      fs.writeFileSync(path.join(skillDir, 'scripts', 'example.ts'),
        `#!/usr/bin/env npx tsx\n/**\n * Example script for ${name}\n */\nconsole.log('Hello from ${name}!');\n`);

      // Update lockfile
      const lock = readSkillsLock(skillsDir);
      lock.skills[name] = {
        name,
        version: '1.0.0',
        source: 'local',
        installedAt: new Date().toISOString(),
      };
      writeSkillsLock(skillsDir, lock);

      success(`Skill "${name}" created at ${skillDir}/`);
      info('Files created:');
      dim(`  ${skillDir}/SKILL.md`);
      dim(`  ${skillDir}/references/README.md`);
      dim(`  ${skillDir}/scripts/example.ts`);
      dim(`  ${skillDir}/assets/`);
      console.log();
      info(`Edit ${colors.cyan}SKILL.md${colors.reset} to add instructions for your agent.`);
      info('The skill will be auto-discovered by the Mastra Workspace.');
    });

  // ─── skills show ──────────────────────────────────────────────────
  skills
    .command('show <name>')
    .description('Show full SKILL.md content for installed skill')
    .action(async (name) => {
      const skillsDir = resolveSkillsDir();
      const skillDir = path.join(skillsDir, name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      if (!fs.existsSync(skillMdPath)) {
        error(`Skill "${name}" not found or SKILL.md missing.`);
        info('Install a skill first: agentforge skills install <name>');
        process.exit(1);
      }

      const content = fs.readFileSync(skillMdPath, 'utf-8');
      header(`SKILL.md: ${name}`);
      console.log(content);
    });

  // ─── skills refs ───────────────────────────────────────────────────
  skills
    .command('refs <name>')
    .description('List reference files for a skill')
    .action(async (name) => {
      const skillsDir = resolveSkillsDir();
      const skillDir = path.join(skillsDir, name);
      const refsDir = path.join(skillDir, 'references');

      if (!fs.existsSync(skillDir)) {
        error(`Skill "${name}" not found.`);
        process.exit(1);
      }

      if (!fs.existsSync(refsDir)) {
        warn(`No references/ directory for skill "${name}".`);
        dim(`Path: ${refsDir}`);
        return;
      }

      header(`References: ${name}`);
      dim(`Path: ${refsDir}`);
      console.log();

      const files = fs.readdirSync(refsDir);
      if (files.length === 0) {
        info('References directory is empty.');
        return;
      }

      for (const file of files) {
        const filePath = path.join(refsDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const content = fs.readFileSync(filePath, 'utf-8');
          console.log(`${colors.cyan}📄 ${file}${colors.reset}`);
          console.log('─'.repeat(60));
          dim(content.trim().split('\n').slice(0, 20).map((l: string) => `  ${l}`).join('\n'));
          if (content.trim().split('\n').length > 20) {
            dim('  ...');
          }
          console.log();
        }
      }
    });

  // ─── skills info ──────────────────────────────────────────────────
  skills
    .command('info')
    .argument('<name>', 'Skill name')
    .description('Show detailed information about a skill')
    .action(async (name) => {
      // Check installed first
      const skillsDir = resolveSkillsDir();
      const skillDir = path.join(skillsDir, name);

      if (fs.existsSync(skillDir) && fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
        const meta = readSkillMetadata(skillDir);
        const lock = readSkillsLock(skillsDir);
        const lockEntry = lock.skills[name];

        header(`Skill: ${meta?.name || name}`);
        details({
          Name: meta?.name || name,
          Description: meta?.description || '—',
          Version: meta?.version || '—',
          Tags: (meta?.tags || []).join(', ') || '—',
          Author: meta?.author || '—',
          Source: lockEntry?.source || 'local',
          'Installed At': lockEntry?.installedAt || '—',
          Path: skillDir,
        });

        // List files
        dim('  Files:');
        const listFiles = (dir: string, prefix: string = '') => {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              dim(`  ${prefix}${entry}/`);
              listFiles(fullPath, prefix + '  ');
            } else {
              dim(`  ${prefix}${entry}`);
            }
          }
        };
        listFiles(skillDir, '  ');
        console.log();

        // Show SKILL.md content
        const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
        const { content: body } = parseSkillMd(content);
        info('Instructions preview:');
        dim(body.trim().split('\n').slice(0, 10).map((l: string) => `  ${l}`).join('\n'));
        if (body.trim().split('\n').length > 10) {
          dim('  ...');
        }
        return;
      }

      // Check registry
      const entry = findInRegistry(name);
      if (entry) {
        header(`Registry Skill: ${entry.name}`);
        details({
          Name: entry.name,
          Description: entry.description,
          Version: entry.version,
          Tags: entry.tags.join(', '),
          Author: entry.author,
          Source: entry.source,
          Status: 'Not installed',
        });
        info(`Install with: ${colors.cyan}agentforge skills install ${entry.name}${colors.reset}`);
        return;
      }

      error(`Skill "${name}" not found (installed or in registry).`);
    });

  // ─── skills bundled ────────────────────────────────────────────────────
  // List and run bundled skills (lightweight built-in capabilities)
  skills
    .command('bundled')
    .description('List bundled skills (lightweight built-in capabilities)')
    .action(async () => {
      const { BUNDLED_SKILLS } = await import('@agentforge-ai/core');
      header('Bundled Skills');
      table(
        BUNDLED_SKILLS.map((s) => ({
          Name: s.name,
          Description: truncate(s.description, 60),
          Category: s.category,
        }))
      );
      info(`Run a bundled skill: ${colors.cyan}agentforge skills run <name> --args '{"key":"value"}'${colors.reset}`);
    });

  // ─── skills run ────────────────────────────────────────────────────────────
  // Execute a bundled skill directly from CLI
  skills
    .command('run')
    .argument('<name>', 'Bundled skill name (e.g., calculator, datetime, web-search)')
    .option('--args <json>', 'Arguments as JSON string')
    .description('Run a bundled skill directly from the CLI')
    .action(async (name, opts) => {
      const { bundledSkillRegistry } = await import('@agentforge-ai/core');

      // Check if skill exists
      if (!bundledSkillRegistry.has(name)) {
        error(`Bundled skill "${name}" not found.`);
        info('Available bundled skills:');
        const skills = bundledSkillRegistry.list();
        for (const s of skills) {
          dim(`  - ${s.name}: ${s.description}`);
        }
        process.exit(1);
      }

      // Parse arguments
      let args: Record<string, unknown> = {};
      if (opts.args) {
        try {
          args = JSON.parse(opts.args);
        } catch {
          error('Invalid JSON in --args');
          process.exit(1);
        }
      }

      header(`Running bundled skill: ${name}`);
      info('Arguments:');
      if (Object.keys(args).length > 0) {
        for (const [key, value] of Object.entries(args)) {
          dim(`  ${key}: ${JSON.stringify(value)}`);
        }
      } else {
        dim('  (no arguments)');
      }
      console.log();

      const startTime = Date.now();
      try {
        const result = await bundledSkillRegistry.execute(name, args);
        const elapsed = Date.now() - startTime;

        success('Result:');
        console.log(result);
        console.log();
        dim(`Completed in ${elapsed}ms`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        error(`Skill execution failed: ${errMsg}`);
        process.exit(1);
      }
    });

  // ─── Top-level alias: agentforge install <skill> ──────────────────
  program
    .command('install')
    .argument('<name>', 'Skill name to install')
    .option('--from <source>', 'Source: registry (default), github, local', 'registry')
    .description('Install a skill (alias for: agentforge skills install)')
    .action(async (name, opts) => {
      // Delegate to skills install
      const skillsCmd = skills.commands.find((c) => c.name() === 'install');
      if (skillsCmd) {
        await skillsCmd.parseAsync([name, ...(opts.from !== 'registry' ? ['--from', opts.from] : [])], { from: 'user' });
      }
    });
}
