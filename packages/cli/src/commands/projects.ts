import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, details, success, error, info, formatDate } from '../lib/display.js';
import readline from 'node:readline';

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

export function registerProjectsCommand(program: Command) {
  const projects = program.command('projects').description('Manage projects and workspaces');

  projects
    .command('list')
    .option('--json', 'Output as JSON')
    .description('List all projects')
    .action(async (opts) => {
      const client = createClient();
      const result = await safeCall(() => client.query('projects:list' as any, {}), 'Failed to list projects');
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Projects');
      const items = (result as any[]) || [];
      if (items.length === 0) { info('No projects. Create one with: agentforge projects create <name>'); return; }
      table(items.map((p: any) => ({
        ID: p._id?.slice(-8) || 'N/A',
        Name: p.name,
        Status: p.status,
        Description: (p.description || '').slice(0, 40),
        Created: formatDate(p.createdAt),
      })));
    });

  projects
    .command('create')
    .argument('<name>', 'Project name')
    .option('-d, --description <desc>', 'Project description')
    .description('Create a new project')
    .action(async (name, opts) => {
      const description = opts.description || await prompt('Description (optional): ');
      const client = createClient();
      await safeCall(
        () => client.mutation('projects:create' as any, { name, description, status: 'active' }),
        'Failed to create project'
      );
      success(`Project "${name}" created.`);
    });

  projects
    .command('inspect')
    .argument('<id>', 'Project ID')
    .description('Show project details')
    .action(async (id) => {
      const client = createClient();
      const projects = await safeCall(() => client.query('projects:list' as any, {}), 'Failed');
      const project = (projects as any[]).find((p: any) => p._id === id || p._id?.endsWith(id));
      if (!project) { error(`Project "${id}" not found.`); process.exit(1); }
      header(`Project: ${project.name}`);
      details({
        ID: project._id,
        Name: project.name,
        Status: project.status,
        Description: project.description || 'N/A',
        Created: formatDate(project.createdAt),
        Updated: formatDate(project.updatedAt),
      });
    });

  projects
    .command('delete')
    .argument('<id>', 'Project ID')
    .option('-f, --force', 'Skip confirmation')
    .description('Delete a project')
    .action(async (id, opts) => {
      if (!opts.force) {
        const confirm = await prompt(`Delete project "${id}"? (y/N): `);
        if (confirm.toLowerCase() !== 'y') { info('Cancelled.'); return; }
      }
      const client = createClient();
      await safeCall(() => client.mutation('projects:remove' as any, { _id: id }), 'Failed');
      success(`Project "${id}" deleted.`);
    });

  projects
    .command('switch')
    .argument('<id>', 'Project ID to switch to')
    .description('Set the active project')
    .action(async (id) => {
      const client = createClient();
      // Verify project exists
      const projects = await safeCall(() => client.query('projects:list' as any, {}), 'Failed');
      const project = (projects as any[]).find((p: any) => p._id === id || p._id?.endsWith(id));
      if (!project) { error(`Project "${id}" not found.`); process.exit(1); }
      // Store active project in settings
      await safeCall(
        () => client.mutation('settings:set' as any, { userId: 'cli', key: 'activeProject', value: project._id }),
        'Failed to switch project'
      );
      success(`Switched to project "${project.name}".`);
    });
}
