import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import {
  getGlobalSkillsDir,
  installSkillFromPath,
  listInstalledSkills,
  removeSkill,
  getGitHubUrl,
} from './skill.js';

describe('Skill CLI', () => {
  const testDir = path.join(os.tmpdir(), 'agentforge-skill-test-' + Date.now());
  const skillsDir = path.join(testDir, '.agentforge', 'skills');

  beforeEach(async () => {
    await fs.mkdirp(skillsDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  // ─── getGlobalSkillsDir ───────────────────────────────────────────────────

  describe('getGlobalSkillsDir', () => {
    it('should return a path ending with .agentforge/skills', () => {
      const dir = getGlobalSkillsDir();
      expect(dir).toContain('.agentforge');
      expect(dir).toContain('skills');
      expect(dir).toMatch(/\.agentforge[/\\]skills$/);
    });

    it('should be under the home directory', () => {
      const dir = getGlobalSkillsDir();
      expect(dir.startsWith(os.homedir())).toBe(true);
    });
  });

  // ─── installSkillFromPath ────────────────────────────────────────────────

  describe('installSkillFromPath', () => {
    it('should copy a local skill directory to the global skills dir', async () => {
      // Create a fake source skill
      const sourceDir = path.join(testDir, 'my-skill');
      await fs.mkdirp(sourceDir);
      await fs.writeFile(
        path.join(sourceDir, 'SKILL.md'),
        `---
name: my-skill
description: A test skill
version: 1.2.3
---

# My Skill

Instructions here.
`
      );
      await fs.writeFile(path.join(sourceDir, 'extra.txt'), 'extra content');

      const installedPath = await installSkillFromPath(sourceDir, skillsDir);

      // The installed path should exist under skillsDir
      expect(installedPath).toBe(path.join(skillsDir, 'my-skill'));
      expect(await fs.pathExists(path.join(installedPath, 'SKILL.md'))).toBe(true);
      expect(await fs.pathExists(path.join(installedPath, 'extra.txt'))).toBe(true);
    });

    it('should throw if source has no SKILL.md', async () => {
      const sourceDir = path.join(testDir, 'invalid-skill');
      await fs.mkdirp(sourceDir);
      // No SKILL.md

      await expect(installSkillFromPath(sourceDir, skillsDir)).rejects.toThrow(
        /SKILL\.md/i
      );
    });

    it('should throw if source path does not exist', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist');

      await expect(installSkillFromPath(nonExistentPath, skillsDir)).rejects.toThrow(
        /not found|does not exist|ENOENT/i
      );
    });
  });

  // ─── listInstalledSkills ─────────────────────────────────────────────────

  describe('listInstalledSkills', () => {
    it('should return empty array when no skills installed', async () => {
      const skills = await listInstalledSkills(skillsDir);
      expect(skills).toEqual([]);
    });

    it('should list installed skills with metadata', async () => {
      // Install two skills
      const skill1Dir = path.join(skillsDir, 'skill-one');
      const skill2Dir = path.join(skillsDir, 'skill-two');
      await fs.mkdirp(skill1Dir);
      await fs.mkdirp(skill2Dir);

      await fs.writeFile(
        path.join(skill1Dir, 'SKILL.md'),
        `---
name: skill-one
description: First test skill
version: 1.0.0
---
# Skill One
`
      );

      await fs.writeFile(
        path.join(skill2Dir, 'SKILL.md'),
        `---
name: skill-two
description: Second test skill
version: 2.0.0
---
# Skill Two
`
      );

      const skills = await listInstalledSkills(skillsDir);

      expect(skills).toHaveLength(2);
      const names = skills.map((s) => s.name).sort();
      expect(names).toEqual(['skill-one', 'skill-two']);

      const skillOne = skills.find((s) => s.name === 'skill-one');
      expect(skillOne?.description).toBe('First test skill');
      expect(skillOne?.version).toBe('1.0.0');

      const skillTwo = skills.find((s) => s.name === 'skill-two');
      expect(skillTwo?.description).toBe('Second test skill');
      expect(skillTwo?.version).toBe('2.0.0');
    });

    it('should ignore directories without SKILL.md', async () => {
      // A directory without SKILL.md
      const noSkillDir = path.join(skillsDir, 'not-a-skill');
      await fs.mkdirp(noSkillDir);
      await fs.writeFile(path.join(noSkillDir, 'README.md'), '# Not a skill');

      // A valid skill
      const validDir = path.join(skillsDir, 'valid-skill');
      await fs.mkdirp(validDir);
      await fs.writeFile(
        path.join(validDir, 'SKILL.md'),
        `---
name: valid-skill
description: A valid skill
version: 1.0.0
---
# Valid
`
      );

      const skills = await listInstalledSkills(skillsDir);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('valid-skill');
    });
  });

  // ─── removeSkill ─────────────────────────────────────────────────────────

  describe('removeSkill', () => {
    it('should remove an installed skill', async () => {
      // Install a skill first
      const skillDir = path.join(skillsDir, 'removable-skill');
      await fs.mkdirp(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: removable-skill
description: Will be removed
version: 1.0.0
---
# Removable
`
      );

      expect(await fs.pathExists(skillDir)).toBe(true);

      await removeSkill('removable-skill', skillsDir);

      expect(await fs.pathExists(skillDir)).toBe(false);
    });

    it('should throw if skill does not exist', async () => {
      await expect(removeSkill('non-existent-skill', skillsDir)).rejects.toThrow(
        /not found|does not exist/i
      );
    });
  });

  // ─── getGitHubUrl ────────────────────────────────────────────────────────

  describe('installSkillFromGitHub', () => {
    it('should construct correct GitHub URL from owner/repo format', () => {
      const url = getGitHubUrl('myorg/my-skill');
      expect(url).toBe('https://github.com/myorg/my-skill');
    });

    it('should return an already-full GitHub URL unchanged', () => {
      const fullUrl = 'https://github.com/myorg/my-skill';
      const url = getGitHubUrl(fullUrl);
      expect(url).toBe(fullUrl);
    });

    it('should handle owner/repo.git format by preserving it', () => {
      const url = getGitHubUrl('myorg/my-skill.git');
      expect(url).toBe('https://github.com/myorg/my-skill.git');
    });
  });
});
