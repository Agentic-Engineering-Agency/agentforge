import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, details, success, error, info, formatDate } from '../lib/display.js';

export function registerSessionsCommand(program: Command) {
  const sessions = program.command('sessions').description('Manage sessions');

  sessions
    .command('list')
    .option('--status <status>', 'Filter by status (active, ended)')
    .option('--json', 'Output as JSON')
    .description('List all sessions')
    .action(async (opts) => {
      const client = createClient();
      const result = await safeCall(() => client.query('sessions:list' as any, {}), 'Failed to list sessions');
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Sessions');
      const items = (result as any[]) || [];
      if (items.length === 0) { info('No sessions found.'); return; }
      const filtered = opts.status ? items.filter((s: any) => s.status === opts.status) : items;
      table(filtered.map((s: any) => ({
        ID: s._id?.slice(-8) || 'N/A',
        Name: s.name || 'Unnamed',
        Agent: s.agentId,
        Status: s.status,
        Started: formatDate(s.startedAt),
        'Last Activity': formatDate(s.lastActivityAt),
      })));
    });

  sessions
    .command('inspect')
    .argument('<id>', 'Session ID')
    .description('Show session details')
    .action(async (id) => {
      const client = createClient();
      const session = await safeCall(() => client.query('sessions:getById' as any, { id }), 'Failed to fetch session');
      if (!session) { error(`Session "${id}" not found.`); process.exit(1); }
      const s = session as any;
      header(`Session: ${s.name || 'Unnamed'}`);
      details({ ID: s._id, Name: s.name, Agent: s.agentId, Status: s.status, Started: formatDate(s.startedAt), 'Last Activity': formatDate(s.lastActivityAt) });
    });

  sessions
    .command('end')
    .argument('<id>', 'Session ID')
    .description('End an active session')
    .action(async (id) => {
      const client = createClient();
      await safeCall(() => client.mutation('sessions:update' as any, { _id: id, status: 'ended' }), 'Failed to end session');
      success(`Session "${id}" ended.`);
    });
}

export function registerThreadsCommand(program: Command) {
  const threads = program.command('threads').description('Manage conversation threads');

  threads
    .command('list')
    .option('--agent <id>', 'Filter by agent ID')
    .option('--json', 'Output as JSON')
    .description('List all threads')
    .action(async (opts) => {
      const client = createClient();
      const args = opts.agent ? { agentId: opts.agent } : {};
      const result = await safeCall(() => client.query('threads:list' as any, args), 'Failed to list threads');
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Threads');
      const items = (result as any[]) || [];
      if (items.length === 0) { info('No threads found.'); return; }
      table(items.map((t: any) => ({
        ID: t._id?.slice(-8) || 'N/A',
        Name: t.name || 'Unnamed',
        Agent: t.agentId,
        Status: t.status,
        Created: formatDate(t.createdAt),
      })));
    });

  threads
    .command('inspect')
    .argument('<id>', 'Thread ID')
    .description('Show thread messages')
    .action(async (id) => {
      const client = createClient();
      const messages = await safeCall(() => client.query('messages:listByThread' as any, { threadId: id }), 'Failed to fetch messages');
      header(`Thread: ${id}`);
      const items = (messages as any[]) || [];
      if (items.length === 0) { info('No messages in this thread.'); return; }
      items.forEach((m: any) => {
        const role = m.role === 'user' ? '\x1b[32mUser\x1b[0m' : m.role === 'assistant' ? '\x1b[36mAssistant\x1b[0m' : `\x1b[33m${m.role}\x1b[0m`;
        console.log(`  ${role}: ${m.content}`);
      });
      console.log();
    });

  threads
    .command('delete')
    .argument('<id>', 'Thread ID')
    .description('Delete a thread and its messages')
    .action(async (id) => {
      const client = createClient();
      await safeCall(() => client.mutation('threads:remove' as any, { _id: id }), 'Failed to delete thread');
      success(`Thread "${id}" deleted.`);
    });
}
