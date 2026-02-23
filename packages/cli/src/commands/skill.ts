import type { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { header, table, success, error, info, dim, truncate, colors } from '../lib/display.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillMetadata {
  name: string;
  description: string;
  version: string;
}

// ─── Utility Functions (exported for testing) ─────────────────────────────────

/**
 * Returns the global skills directory: ~/.agentforge/skills/
 */
export function getGlobalSkillsDir(): string {
  return path.join(os.homedir(), '.agentforge', 'skills');
}

/**
 * Parse SKILL.md frontmatter to extract metadata.
 * Uses a simple regex-based YAML frontmatter parser.
 */
function parseSkillMd(content: string): SkillMetadata {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return { name: '', description: '', version: '1.0.0' };
  }

  const frontmatter = fmMatch[1];
  const data: Record<string, string> = {};

  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      data[match[1]] = match[2].trim();
    }
  }

  return {
    name: data['name'] || '',
    description: data['description'] || '',
    version: data['version'] || '1.0.0',
  };
}

/**
 * Install a skill from a local directory path into the global skills dir.
 * Returns the path where the skill was installed.
 */
export async function installSkillFromPath(
  sourcePath: string,
  skillsDir: string
): Promise<string> {
  if (!(await fs.pathExists(sourcePath))) {
    throw new Error(`Source path not found: ${sourcePath}`);
  }

  const skillMdPath = path.join(sourcePath, 'SKILL.md');
  if (!(await fs.pathExists(skillMdPath))) {
    throw new Error(`No SKILL.md found in ${sourcePath}. Not a valid skill directory.`);
  }

  const skillName = path.basename(sourcePath);
  const destPath = path.join(skillsDir, skillName);

  await fs.mkdirp(skillsDir);
  await fs.copy(sourcePath, destPath, { overwrite: true });

  return destPath;
}

/**
 * List all skills installed in the given skills directory.
 * Returns an array of skill metadata objects.
 */
export async function listInstalledSkills(
  skillsDir: string
): Promise<Array<{ name: string; version: string; description: string }>> {
  if (!(await fs.pathExists(skillsDir))) {
    return [];
  }

  const entries = await fs.readdir(skillsDir);
  const skills: Array<{ name: string; version: string; description: string }> = [];

  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry);
    const stat = await fs.stat(entryPath);
    if (!stat.isDirectory()) continue;

    const skillMdPath = path.join(entryPath, 'SKILL.md');
    if (!(await fs.pathExists(skillMdPath))) continue;

    const content = await fs.readFile(skillMdPath, 'utf-8');
    const meta = parseSkillMd(content);

    skills.push({
      name: meta.name || entry,
      version: meta.version,
      description: meta.description,
    });
  }

  return skills;
}

/**
 * Remove a skill from the skills directory by name.
 * Throws if the skill does not exist.
 */
export async function removeSkill(name: string, skillsDir: string): Promise<void> {
  const skillDir = path.join(skillsDir, name);

  if (!(await fs.pathExists(skillDir))) {
    throw new Error(`Skill "${name}" not found in ${skillsDir}`);
  }

  await fs.remove(skillDir);
}

/**
 * Construct a full GitHub URL from an owner/repo shorthand or return the URL as-is.
 */
export function getGitHubUrl(nameOrUrl: string): string {
  if (nameOrUrl.startsWith('https://') || nameOrUrl.startsWith('http://')) {
    return nameOrUrl;
  }
  return `https://github.com/${nameOrUrl}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConvexUrl(): string | undefined {
  return process.env['CONVEX_URL'] || process.env['NEXT_PUBLIC_CONVEX_URL'];
}

// ─── Command Registration ─────────────────────────────────────────────────────

export function registerSkillCommand(program: Command): void {
  const skillCmd = program
    .command('skill')
    .description('Manage global skills installed in ~/.agentforge/skills/');

  // ─── skill install ─────────────────────────────────────────────────
  skillCmd
    .command('install')
    .argument('<name>', 'Local path or GitHub owner/repo to install from')
    .description('Install a skill to ~/.agentforge/skills/')
    .action(async (name: string) => {
      const skillsDir = getGlobalSkillsDir();

      // Determine if name is a local path or a GitHub shorthand/URL
      const isLocalPath = await fs.pathExists(name);

      if (isLocalPath) {
        // ─── Install from local path ─────────────────────────────
        const sourcePath = path.resolve(name);
        try {
          const installedPath = await installSkillFromPath(sourcePath, skillsDir);
          const skillName = path.basename(installedPath);
          success(`Skill "${skillName}" installed from local path.`);
          info(`Location: ${installedPath}`);
        } catch (err: unknown) {
          error((err as Error).message);
          process.exit(1);
        }
      } else {
        // ─── Install from GitHub ─────────────────────────────────
        const repoUrl = getGitHubUrl(name);
        const repoName = name.split('/').pop()!.replace(/\.git$/, '');
        const destPath = path.join(skillsDir, repoName);

        await fs.mkdirp(skillsDir);

        info(`Cloning skill from ${repoUrl}...`);
        try {
          // Use execFileSync with array args to prevent shell injection
          execFileSync('git', ['clone', '--depth', '1', repoUrl, destPath], {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          // Remove .git directory to keep it clean
          await fs.remove(path.join(destPath, '.git'));

          const skillMdPath = path.join(destPath, 'SKILL.md');
          if (!(await fs.pathExists(skillMdPath))) {
            error('Cloned repo does not contain a SKILL.md. Not a valid skill.');
            await fs.remove(destPath);
            process.exit(1);
          }

          success(`Skill "${repoName}" installed from GitHub.`);
          info(`Location: ${destPath}`);
        } catch (err: unknown) {
          error(`Failed to clone: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    });

  // ─── skill list ────────────────────────────────────────────────────
  skillCmd
    .command('list')
    .description('List skills installed in ~/.agentforge/skills/')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const skillsDir = getGlobalSkillsDir();

      header('Global Skills');

      let skills: Array<{ name: string; version: string; description: string }>;
      try {
        skills = await listInstalledSkills(skillsDir);
      } catch {
        skills = [];
      }

      if (skills.length === 0) {
        info('No global skills installed.');
        dim(
          `  Install a skill with: ${colors.cyan}agentforge skill install <path-or-owner/repo>${colors.reset}`
        );
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(skills, null, 2));
        return;
      }

      table(
        skills.map((s) => ({
          Name: s.name,
          Version: s.version,
          Description: truncate(s.description, 60),
        }))
      );

      dim(`  Skills directory: ${skillsDir}`);
    });

  // ─── skill remove ──────────────────────────────────────────────────
  skillCmd
    .command('remove')
    .argument('<name>', 'Skill name to remove')
    .description('Remove a skill from ~/.agentforge/skills/')
    .action(async (name: string) => {
      const skillsDir = getGlobalSkillsDir();

      try {
        await removeSkill(name, skillsDir);
        success(`Skill "${name}" removed.`);
      } catch (err: unknown) {
        error((err as Error).message);
        info('List installed skills with: agentforge skill list');
        process.exit(1);
      }
    });

  // ─── skill search ──────────────────────────────────────────────────
  skillCmd
    .command('search <query>')
    .description('Search the skill marketplace')
    .option('-c, --category <category>', 'Filter by category')
    .action(async (query: string, options: { category?: string }) => {
      const { searchSkills: searchMarketplace } = await import('@agentforge-ai/core');
      const convexUrl = getConvexUrl();
      if (!convexUrl) {
        error('No CONVEX_URL configured. Set CONVEX_URL environment variable.');
        return;
      }
      try {
        info(`Searching marketplace for "${query}"...`);
        const skills = await searchMarketplace(query, convexUrl, options.category);
        if (skills.length === 0) {
          info('No skills found matching your query.');
          return;
        }
        header(`Found ${skills.length} skill(s)`);
        table(
          skills.map((s) => ({
            Name: s.name,
            Version: s.version,
            Category: s.category,
            Downloads: s.downloads.toString(),
            Description: truncate(s.description, 50),
          }))
        );
      } catch (err: unknown) {
        error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  // ─── skill publish ─────────────────────────────────────────────────
  skillCmd
    .command('publish')
    .description('Publish a skill to the marketplace')
    .option('-d, --dir <directory>', 'Skill directory (default: current directory)', '.')
    .action(async (options: { dir: string }) => {
      const fsExtra = await import('fs-extra');
      const pathMod = await import('node:path');
      const { parseSkillManifest, publishSkill: publishToMarketplace } = await import('@agentforge-ai/core');

      const convexUrl = getConvexUrl();
      if (!convexUrl) {
        error('No CONVEX_URL configured. Set CONVEX_URL environment variable.');
        return;
      }

      const skillDir = pathMod.resolve(options.dir);
      const skillMdPath = pathMod.join(skillDir, 'SKILL.md');

      if (!(await fsExtra.pathExists(skillMdPath))) {
        error('No SKILL.md found in the specified directory.');
        return;
      }

      try {
        const skillMdContent = await fsExtra.readFile(skillMdPath, 'utf-8');
        const manifest = parseSkillManifest(skillMdContent);

        let readmeContent: string | undefined;
        const readmePath = pathMod.join(skillDir, 'README.md');
        if (await fsExtra.pathExists(readmePath)) {
          readmeContent = await fsExtra.readFile(readmePath, 'utf-8');
        }

        const meta = manifest.metadata ?? {};
        info(`Publishing "${manifest.name}" v${manifest.version}...`);
        await publishToMarketplace(
          {
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            author: meta.author ?? 'unknown',
            category: (meta as Record<string, unknown>)['category'] as string ?? 'general',
            tags: meta.tags ?? [],
            skillMdContent,
            readmeContent,
            repositoryUrl: meta.repository,
          },
          convexUrl,
        );
        success(`Skill "${manifest.name}" published successfully!`);
      } catch (err: unknown) {
        error(`Publish failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  // ─── skill featured ────────────────────────────────────────────────
  skillCmd
    .command('featured')
    .description('Show featured skills from the marketplace')
    .action(async () => {
      const { fetchFeaturedSkills } = await import('@agentforge-ai/core');
      const convexUrl = getConvexUrl();
      if (!convexUrl) {
        error('No CONVEX_URL configured. Set CONVEX_URL environment variable.');
        return;
      }
      try {
        const skills = await fetchFeaturedSkills(convexUrl);
        if (skills.length === 0) {
          info('No featured skills available.');
          return;
        }
        header('Featured Skills');
        table(
          skills.map((s) => ({
            Name: s.name,
            Version: s.version,
            Category: s.category,
            Downloads: s.downloads.toString(),
            Description: truncate(s.description, 60),
          }))
        );
      } catch (err: unknown) {
        error(`Failed to fetch featured skills: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}
