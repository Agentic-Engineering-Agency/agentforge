import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, success, error, info, dim, colors, formatDate } from '../lib/display.js';
import fs from 'fs-extra';
import path from 'node:path';
import readline from 'node:readline';

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

export function registerSkillsCommand(program: Command) {
  const skills = program.command('skills').description('Manage agent skills');

  skills
    .command('list')
    .option('--installed', 'Show only installed skills')
    .option('--json', 'Output as JSON')
    .description('List all skills')
    .action(async (opts) => {
      const client = await createClient();
      const result = await safeCall(() => client.query('skills:list' as any, {}), 'Failed to list skills');
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Skills');

      // Also check local skills directory
      const localSkills: string[] = [];
      const skillsDir = path.join(process.cwd(), 'skills');
      if (fs.existsSync(skillsDir)) {
        const dirs = fs.readdirSync(skillsDir).filter((d: string) => fs.statSync(path.join(skillsDir, d)).isDirectory());
        localSkills.push(...dirs);
      }

      const items = (result as any[]) || [];
      if (items.length === 0 && localSkills.length === 0) {
        info('No skills found. Install one with: agentforge skills install <name>');
        info('Or create one with: agentforge skills create');
        return;
      }

      if (localSkills.length > 0) {
        dim('  Local Skills:');
        localSkills.forEach((s) => {
          const configPath = path.join(skillsDir, s, 'config.json');
          let desc = '';
          if (fs.existsSync(configPath)) {
            try { desc = JSON.parse(fs.readFileSync(configPath, 'utf-8')).description || ''; } catch {}
          }
          console.log(`  ${colors.cyan}●${colors.reset} ${s} ${colors.dim}${desc}${colors.reset}`);
        });
        console.log();
      }

      if (items.length > 0) {
        const filtered = opts.installed ? items.filter((s: any) => s.isInstalled) : items;
        table(filtered.map((s: any) => ({
          Name: s.name,
          Category: s.category,
          Version: s.version,
          Installed: s.isInstalled ? '✔' : '✖',
          Agent: s.agentId || 'all',
        })));
      }
    });

  skills
    .command('create')
    .description('Create a new skill (interactive)')
    .option('--name <name>', 'Skill name')
    .option('--description <desc>', 'Skill description')
    .option('--category <cat>', 'Category (utility, web, file, data, integration, ai, custom)')
    .action(async (opts) => {
      const name = opts.name || await prompt('Skill name (kebab-case): ');
      const description = opts.description || await prompt('Description: ');
      const category = opts.category || await prompt('Category (utility/web/file/data/integration/ai/custom): ') || 'custom';

      if (!name) { error('Skill name is required.'); process.exit(1); }

      const skillDir = path.join(process.cwd(), 'skills', name);
      if (fs.existsSync(skillDir)) { error(`Skill "${name}" already exists at ${skillDir}`); process.exit(1); }

      fs.mkdirSync(skillDir, { recursive: true });

      // config.json
      fs.writeFileSync(path.join(skillDir, 'config.json'), JSON.stringify({
        name, version: '1.0.0', description, category, author: 'User',
        tools: [name], dependencies: [],
        agentInstructions: `You have access to the ${name} skill. ${description}`,
      }, null, 2));

      // index.ts
      fs.writeFileSync(path.join(skillDir, 'index.ts'), `import { z } from 'zod';

/**
 * ${name} — AgentForge Skill
 * ${description}
 */
export const tools = [
  {
    name: '${name}',
    description: '${description}',
    inputSchema: z.object({
      input: z.string().describe('Input for ${name}'),
    }),
    outputSchema: z.object({
      result: z.string(),
      success: z.boolean(),
    }),
    handler: async (params: { input: string }) => {
      // TODO: Implement your skill logic here
      return { result: \`Processed: \${params.input}\`, success: true };
    },
  },
];

export default { tools };
`);

      // SKILL.md
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${name}\n\n${description}\n\n## Usage\n\nAsk your agent: "Use the ${name} tool to [your request]"\n\n## Configuration\n\nEdit \`skills/${name}/config.json\` to customize.\n`);

      success(`Skill "${name}" created at skills/${name}/`);
      info('Files created: index.ts, config.json, SKILL.md');
      info(`Edit skills/${name}/index.ts to implement your tool logic.`);
    });

  skills
    .command('install')
    .argument('<name>', 'Skill name to install')
    .description('Install a skill')
    .action(async (name) => {
      const client = await createClient();
      await safeCall(
        () => client.mutation('skills:create' as any, {
          name, category: 'custom', version: '1.0.0', isInstalled: true,
        }),
        'Failed to install skill'
      );
      success(`Skill "${name}" installed.`);
    });

  skills
    .command('remove')
    .argument('<name>', 'Skill name to remove')
    .description('Remove a skill')
    .action(async (name) => {
      const skillDir = path.join(process.cwd(), 'skills', name);
      if (fs.existsSync(skillDir)) {
        const confirm = await prompt(`Remove skill "${name}" and delete files? (y/N): `);
        if (confirm.toLowerCase() === 'y') {
          fs.removeSync(skillDir);
          success(`Skill "${name}" removed from disk.`);
        }
      }
      // Also remove from Convex
      const client = await createClient();
      try {
        const skills = await client.query('skills:list' as any, {});
        const skill = (skills as any[]).find((s: any) => s.name === name);
        if (skill) {
          await client.mutation('skills:remove' as any, { _id: skill._id });
          success(`Skill "${name}" removed from database.`);
        }
      } catch { /* ignore if not in db */ }
    });

  skills
    .command('search')
    .argument('<query>', 'Search query')
    .description('Search available skills')
    .action(async (query) => {
      header('Skill Search Results');
      // Search built-in examples
      const examples = [
        { name: 'web-search', desc: 'Search the web for information', cat: 'web' },
        { name: 'calculator', desc: 'Evaluate mathematical expressions', cat: 'utility' },
        { name: 'file-reader', desc: 'Read file contents', cat: 'file' },
        { name: 'http-request', desc: 'Make HTTP requests', cat: 'web' },
        { name: 'json-transformer', desc: 'Transform JSON data', cat: 'data' },
        { name: 'text-summarizer', desc: 'Summarize text into key points', cat: 'ai' },
        { name: 'csv-parser', desc: 'Parse CSV into structured JSON', cat: 'data' },
      ];
      const q = query.toLowerCase();
      const matches = examples.filter((e) => e.name.includes(q) || e.desc.toLowerCase().includes(q) || e.cat.includes(q));
      if (matches.length === 0) { info(`No skills matching "${query}". Try: agentforge skills create`); return; }
      table(matches.map((e) => ({ Name: e.name, Description: e.desc, Category: e.cat })));
      info('Install with: agentforge skills install <name>');
      info('Or see examples: check skills/skill-creator/SKILL.md');
    });
}
