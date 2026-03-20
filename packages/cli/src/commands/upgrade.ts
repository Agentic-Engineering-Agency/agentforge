import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { readFileSync, existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Options for the upgrade command.
 */
interface UpgradeOptions {
  /** Skip confirmation prompt */
  yes: boolean;
  /** Preview changes without applying */
  dryRun: boolean;
  /** Only upgrade specific file */
  only?: string;
}

/**
 * Change type for file comparison
 */
type ChangeType = 'new' | 'modified' | 'identical';

/**
 * File comparison result
 */
interface FileDiff {
  relativePath: string;
  changeType: ChangeType;
}

/**
 * Resolves the template directory using the same logic as create.ts
 */
function resolveTemplateDir(): string {
  const searchDirs = [
    path.resolve(__dirname, '..', '..', 'default'),                        // dist/default (built)
    path.resolve(__dirname, '..', '..', '..', 'templates', 'default'),     // packages/cli/templates/default (dev)
    path.resolve(__dirname, '..', '..', '..', '..', 'templates', 'default'), // fallback
  ];

  for (const dir of searchDirs) {
    if (existsSync(dir)) {
      return dir;
    }
  }

  throw new Error('Template directory not found');
}

/**
 * Recursively walks a directory and returns all file paths
 */
function walkDir(dir: string, basePath: string = dir, skipPatterns: string[] = ['_generated']): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    // Skip directories matching patterns
    if (stat.isDirectory()) {
      if (skipPatterns.some(pattern => entry.includes(pattern))) {
        continue;
      }
      files.push(...walkDir(fullPath, basePath, skipPatterns));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Gets relative path from base directory
 */
function getRelativePath(fullPath: string, basePath: string): string {
  return path.relative(basePath, fullPath);
}

/**
 * Compares two files and returns their change type
 */
function compareFiles(templatePath: string, userPath: string): ChangeType {
  if (!existsSync(userPath)) {
    return 'new';
  }

  const templateContent = readFileSync(templatePath, 'utf-8');
  const userContent = readFileSync(userPath, 'utf-8');

  if (templateContent === userContent) {
    return 'identical';
  }

  return 'modified';
}

/**
 * Prints a formatted table of file changes
 */
function printDiffTable(diffs: FileDiff[]): void {
  if (diffs.length === 0) {
    console.log('\n  ✅ All files are up to date!\n');
    return;
  }

  console.log('\n  Files to update:\n');
  console.log('  ┌─────────────────────────────────────────────┬──────────┐');
  console.log('  │ File                                       │ Status   │');
  console.log('  ├─────────────────────────────────────────────┼──────────┤');

  for (const diff of diffs) {
    const filename = diff.relativePath.padEnd(43).slice(0, 43);
    let status: string;
    let statusColor: string;

    if (diff.changeType === 'new') {
      status = 'NEW      ';
      statusColor = '\x1b[32m'; // green
    } else {
      status = 'MODIFIED ';
      statusColor = '\x1b[33m'; // yellow
    }

    console.log(`  │ ${filename} │ ${statusColor}${status}\x1b[0m │`);
  }

  console.log('  └─────────────────────────────────────────────┴──────────┘\n');
}

/**
 * Prompts user for confirmation
 */
function promptConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('  Apply these updates? [y/N] ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Backs up files before overwriting
 */
function backupFiles(files: FileDiff[], projectDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(projectDir, 'convex', `.backup-${timestamp}`);

  mkdirSync(backupDir, { recursive: true });

  for (const file of files) {
    const userPath = path.join(projectDir, 'convex', file.relativePath);
    if (existsSync(userPath)) {
      const backupPath = path.join(backupDir, file.relativePath);
      mkdirSync(path.dirname(backupPath), { recursive: true });
      copyFileSync(userPath, backupPath);
    }
  }

  return backupDir;
}

/**
 * Copies template files to user project
 */
function applyUpdates(files: FileDiff[], templateDir: string, projectDir: string): void {
  for (const file of files) {
    const templatePath = path.join(templateDir, 'convex', file.relativePath);
    const userPath = path.join(projectDir, 'convex', file.relativePath);

    mkdirSync(path.dirname(userPath), { recursive: true });
    copyFileSync(templatePath, userPath);
  }
}

/**
 * Upgrades an AgentForge project's convex/ directory with template updates
 *
 * @param options - Options for the upgrade command
 */
export async function upgradeProject(options: UpgradeOptions): Promise<void> {
  const projectDir = process.cwd();
  const convexDir = path.join(projectDir, 'convex');

  // Verify we're in an AgentForge project
  if (!existsSync(convexDir)) {
    console.error('  Error: No convex/ directory found. Are you in an AgentForge project?');
    process.exit(1);
  }

  console.log('\n🔄 Checking for Convex template updates...\n');

  // Resolve template directory
  let templateDir: string;
  try {
    templateDir = resolveTemplateDir();
  } catch (err) {
    console.error('  Error: Template directory not found');
    process.exit(1);
  }

  const templateConvexDir = path.join(templateDir, 'convex');

  if (!existsSync(templateConvexDir)) {
    console.error('  Error: Template convex/ directory not found');
    process.exit(1);
  }

  // Walk template directory
  const templateFiles = walkDir(templateConvexDir);

  // Compare files
  const diffs: FileDiff[] = [];
  for (const templatePath of templateFiles) {
    const relativePath = getRelativePath(templatePath, templateConvexDir);

    // Skip if --only is specified and file doesn't match
    if (options.only && !relativePath.includes(options.only)) {
      continue;
    }

    const userPath = path.join(convexDir, relativePath);
    const changeType = compareFiles(templatePath, userPath);

    if (changeType !== 'identical') {
      diffs.push({ relativePath, changeType });
    }
  }

  // Print table of changes
  printDiffTable(diffs);

  // Handle --dry-run
  if (options.dryRun) {
    console.log('  🔍 Dry run complete — no files modified\n');
    return;
  }

  // If no changes, exit
  if (diffs.length === 0) {
    return;
  }

  // Ask for confirmation (skip if --yes)
  let shouldApply = options.yes;
  if (!shouldApply) {
    shouldApply = await promptConfirmation();
  }

  if (!shouldApply) {
    console.log('  ❌ Upgrade cancelled\n');
    return;
  }

  // Backup files
  console.log('  📦 Backing up files...');
  const backupDir = backupFiles(diffs, projectDir);
  console.log(`  ✅ Backup created at ${backupDir}\n`);

  // Apply updates
  console.log('  🔄 Applying updates...');
  applyUpdates(diffs, templateDir, projectDir);
  console.log(`  ✅ Updated ${diffs.length} file(s)\n`);

  console.log(`🎉 Upgrade complete!\n`);
  console.log(`  ${diffs.length} file(s) updated`);
  console.log(`  Backup: ${backupDir}\n`);
}
