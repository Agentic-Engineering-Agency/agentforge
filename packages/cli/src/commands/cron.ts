import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, success, error, info, formatDate } from '../lib/display.js';
import readline from 'node:readline';

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

export function registerCronCommand(program: Command) {
  const cron = program.command('cron').description('Manage cron jobs');

  cron
    .command('list')
    .option('--json', 'Output as JSON')
    .description('List all cron jobs')
    .action(async (opts) => {
      const client = createClient();
      const result = await safeCall(() => client.query('cronJobs:list' as any, {}), 'Failed to list cron jobs');
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Cron Jobs');
      const items = (result as any[]) || [];
      if (items.length === 0) { info('No cron jobs. Create one with: agentforge cron create'); return; }
      table(items.map((c: any) => ({
        ID: c._id?.slice(-8) || 'N/A',
        Name: c.name,
        Schedule: c.schedule,
        Agent: c.agentId,
        Enabled: c.isEnabled ? '✔' : '✖',
        'Last Run': c.lastRunAt ? formatDate(c.lastRunAt) : 'Never',
        'Next Run': c.nextRunAt ? formatDate(c.nextRunAt) : 'N/A',
      })));
    });

  cron
    .command('create')
    .description('Create a new cron job (interactive)')
    .option('--name <name>', 'Job name')
    .option('--schedule <cron>', 'Cron expression')
    .option('--agent <id>', 'Agent ID')
    .option('--action <action>', 'Action to execute')
    .action(async (opts) => {
      const name = opts.name || await prompt('Job name: ');
      const schedule = opts.schedule || await prompt('Cron schedule (e.g., "0 */5 * * * *" for every 5 min): ');
      const agentId = opts.agent || await prompt('Agent ID: ');
      const action = opts.action || await prompt('Action (message to send to agent): ');

      if (!name || !schedule || !agentId || !action) {
        error('All fields are required.'); process.exit(1);
      }

      const client = createClient();
      await safeCall(
        () => client.mutation('cronJobs:create' as any, { name, schedule, agentId, action, isEnabled: true }),
        'Failed to create cron job'
      );
      success(`Cron job "${name}" created.`);
    });

  cron
    .command('delete')
    .argument('<id>', 'Cron job ID')
    .description('Delete a cron job')
    .action(async (id) => {
      const client = createClient();
      await safeCall(() => client.mutation('cronJobs:remove' as any, { _id: id }), 'Failed to delete');
      success(`Cron job "${id}" deleted.`);
    });

  cron
    .command('enable')
    .argument('<id>', 'Cron job ID')
    .description('Enable a cron job')
    .action(async (id) => {
      const client = createClient();
      await safeCall(() => client.mutation('cronJobs:update' as any, { _id: id, isEnabled: true }), 'Failed');
      success(`Cron job "${id}" enabled.`);
    });

  cron
    .command('disable')
    .argument('<id>', 'Cron job ID')
    .description('Disable a cron job')
    .action(async (id) => {
      const client = createClient();
      await safeCall(() => client.mutation('cronJobs:update' as any, { _id: id, isEnabled: false }), 'Failed');
      success(`Cron job "${id}" disabled.`);
    });
}
