import { Command } from 'commander';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { header, success, error, info, dim } from '../lib/display.js';

export function registerWorkspaceCommand(program: Command) {
  const ws = program.command('workspace').description('Manage agent workspace and skills');

  ws
    .command('init')
    .option('--dir <dir>', 'Project directory', '.')
    .description('Initialize workspace directories (workspace/ and skills/)')
    .action(async (opts) => {
      const base = resolve(opts.dir);
      const workspaceDir = join(base, 'workspace');
      const skillsDir = join(base, 'skills');
      await mkdir(workspaceDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });
      success(`Workspace initialized:`);
      info(`  workspace/  — agent file storage`);
      info(`  skills/     — SKILL.md skills (agentskills.io format)`);
      dim(`\nPlace SKILL.md folders in skills/ for agents to discover them.`);
    });

  ws
    .command('status')
    .option('--dir <dir>', 'Project directory', '.')
    .description('Show workspace status and discovered skills')
    .action(async (opts) => {
      const base = resolve(opts.dir);
      const workspaceDir = join(base, 'workspace');
      const skillsDir = join(base, 'skills');

      header('Workspace Status');

      // Filesystem
      if (existsSync(workspaceDir)) {
        const files = await readdir(workspaceDir).catch(() => []);
        info(`Filesystem: ${workspaceDir}`);
        dim(`  ${files.length} item(s)`);
      } else {
        info(`Filesystem: not initialized`);
        dim(`  Run: agentforge workspace init`);
      }

      // Skills
      if (existsSync(skillsDir)) {
        const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
        const skills = entries.filter(e => e.isDirectory());
        info(`\nSkills: ${skillsDir}`);
        if (skills.length === 0) {
          dim(`  No skills installed.`);
          dim(`  Run: agentforge skills create <name>`);
        } else {
          for (const skill of skills) {
            const skillMd = join(skillsDir, skill.name, 'SKILL.md');
            dim(`  ✓ ${skill.name}${existsSync(skillMd) ? '' : ' (missing SKILL.md)'}`);
          }
        }
      } else {
        info(`\nSkills: not initialized`);
      }
    });
}
