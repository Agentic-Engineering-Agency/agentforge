import fs from 'fs-extra';
import path from 'node:path';

function hasUsableSkillEntries(dir: string): boolean {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return false;
  }

  return fs.readdirSync(dir).some((entry) => entry !== '.DS_Store');
}

export function resolveWorkspaceSkillsBasePath(cwd: string): string {
  const localSkillsPath = path.resolve(cwd, './skills');
  if (hasUsableSkillEntries(localSkillsPath)) {
    return localSkillsPath;
  }

  const canonicalTemplateSkillsPath = path.resolve(cwd, 'packages/cli/templates/default/skills');
  if (hasUsableSkillEntries(canonicalTemplateSkillsPath)) {
    return canonicalTemplateSkillsPath;
  }

  return localSkillsPath;
}
