import type { SkillDefinition } from './types.js';
import { parseSkillManifest } from './skill-parser.js';

/** Interface for filesystem operations (allows both Node.js and web implementations) */
export interface SkillFileSystem {
  readDir(path: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
}

/**
 * Discover skills from a directory.
 * Scans for subdirectories containing SKILL.md files.
 */
export async function discoverSkills(
  skillsDir: string,
  fs: SkillFileSystem,
): Promise<SkillDefinition[]> {
  let entries: string[];
  try {
    entries = await fs.readDir(skillsDir);
  } catch {
    return [];
  }

  const skills: SkillDefinition[] = [];

  for (const entry of entries) {
    const entryPath = `${skillsDir}/${entry}`;

    const isDir = await fs.isDirectory(entryPath);
    if (!isDir) {
      continue;
    }

    const skillMdPath = `${entryPath}/SKILL.md`;
    const hasSkillMd = await fs.exists(skillMdPath);
    if (!hasSkillMd) {
      continue;
    }

    try {
      const content = await fs.readFile(skillMdPath);
      const skill = parseSkillManifest(content);
      skills.push(skill);
    } catch (error) {
      console.debug('[discoverSkills] Failed to parse skill at %s:', skillMdPath, error instanceof Error ? error.message : error);
    }
  }

  return skills;
}

/**
 * Fetch a skill from a GitHub repository URL.
 * Uses fetch() to get the SKILL.md content.
 */
export async function fetchSkillFromGitHub(
  owner: string,
  repo: string,
  branch = 'main',
): Promise<SkillDefinition> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch SKILL.md from GitHub: ${response.status} ${response.statusText}`,
    );
  }

  const content = await response.text();
  return parseSkillManifest(content);
}
