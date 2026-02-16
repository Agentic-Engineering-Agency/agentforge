import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, details, success, error, info, formatDate } from '../lib/display.js';
import readline from 'node:readline';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

export function registerAgentsCommand(program: Command) {
  const agents = program.command('agents').description('Manage agents');

  agents
    .command('list')
    .description('List all agents')
    .option('--active', 'Show only active agents')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = createClient();
      const result = await safeCall(
        () => client.query('agents:list' as any, {}),
        'Failed to list agents'
      );
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      header('Agents');
      if (!result || (result as any[]).length === 0) {
        info('No agents found. Create one with: agentforge agents create');
        return;
      }
      const filtered = opts.active ? (result as any[]).filter((a: any) => a.isActive) : result;
      table(
        (filtered as any[]).map((a: any) => ({
          ID: a.id,
          Name: a.name,
          Model: a.model,
          Provider: a.provider || 'openai',
          Active: a.isActive ? '✔' : '✖',
          Created: formatDate(a.createdAt),
        }))
      );
    });

  agents
    .command('create')
    .description('Create a new agent (interactive)')
    .option('--name <name>', 'Agent name')
    .option('--model <model>', 'Model identifier (e.g., openai:gpt-4o-mini)')
    .option('--instructions <text>', 'System instructions')
    .action(async (opts) => {
      const name = opts.name || await prompt('Agent name: ');
      const model = opts.model || await prompt('Model (e.g., openai:gpt-4o-mini): ');
      const instructions = opts.instructions || await prompt('Instructions: ');

      if (!name || !model || !instructions) {
        error('Name, model, and instructions are required.');
        process.exit(1);
      }

      const provider = model.includes(':') ? model.split(':')[0] : 'openai';
      const agentId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const client = createClient();
      await safeCall(
        () => client.mutation('agents:create' as any, {
          id: agentId,
          name,
          instructions,
          model,
          provider,
          isActive: true,
        }),
        'Failed to create agent'
      );
      success(`Agent "${name}" created with ID: ${agentId}`);
    });

  agents
    .command('inspect')
    .argument('<id>', 'Agent ID')
    .description('Show detailed agent information')
    .action(async (id) => {
      const client = createClient();
      const agent = await safeCall(
        () => client.query('agents:getByAgentId' as any, { id }),
        'Failed to fetch agent'
      );
      if (!agent) {
        error(`Agent "${id}" not found.`);
        process.exit(1);
      }
      header(`Agent: ${(agent as any).name}`);
      const a = agent as any;
      details({
        'ID': a.id,
        'Name': a.name,
        'Model': a.model,
        'Provider': a.provider || 'openai',
        'Active': a.isActive ? 'Yes' : 'No',
        'Temperature': a.temperature ?? 'default',
        'Max Tokens': a.maxTokens ?? 'default',
        'Created': formatDate(a.createdAt),
        'Updated': formatDate(a.updatedAt),
      });
      if (a.description) info(`Description: ${a.description}`);
      console.log(`  Instructions:\n  ${a.instructions.split('\n').join('\n  ')}\n`);
    });

  agents
    .command('edit')
    .argument('<id>', 'Agent ID')
    .option('--name <name>', 'New name')
    .option('--model <model>', 'New model')
    .option('--instructions <text>', 'New instructions')
    .description('Edit an agent')
    .action(async (id, opts) => {
      const client = createClient();
      const agent = await safeCall(
        () => client.query('agents:getByAgentId' as any, { id }),
        'Failed to fetch agent'
      );
      if (!agent) { error(`Agent "${id}" not found.`); process.exit(1); }

      const updates: Record<string, any> = {};
      if (opts.name) updates.name = opts.name;
      if (opts.model) {
        updates.model = opts.model;
        updates.provider = opts.model.includes(':') ? opts.model.split(':')[0] : 'openai';
      }
      if (opts.instructions) updates.instructions = opts.instructions;

      if (Object.keys(updates).length === 0) {
        const a = agent as any;
        const name = await prompt(`Name [${a.name}]: `);
        const model = await prompt(`Model [${a.model}]: `);
        const instr = await prompt(`Instructions [keep current]: `);
        if (name) updates.name = name;
        if (model) { updates.model = model; updates.provider = model.includes(':') ? model.split(':')[0] : 'openai'; }
        if (instr) updates.instructions = instr;
      }

      if (Object.keys(updates).length === 0) { info('No changes made.'); return; }

      await safeCall(
        () => client.mutation('agents:update' as any, { _id: (agent as any)._id, ...updates }),
        'Failed to update agent'
      );
      success(`Agent "${id}" updated.`);
    });

  agents
    .command('delete')
    .argument('<id>', 'Agent ID')
    .option('-f, --force', 'Skip confirmation')
    .description('Delete an agent')
    .action(async (id, opts) => {
      if (!opts.force) {
        const confirm = await prompt(`Delete agent "${id}"? (y/N): `);
        if (confirm.toLowerCase() !== 'y') { info('Cancelled.'); return; }
      }
      const client = createClient();
      const agent = await safeCall(
        () => client.query('agents:getByAgentId' as any, { id }),
        'Failed to fetch agent'
      );
      if (!agent) { error(`Agent "${id}" not found.`); process.exit(1); }
      await safeCall(
        () => client.mutation('agents:remove' as any, { _id: (agent as any)._id }),
        'Failed to delete agent'
      );
      success(`Agent "${id}" deleted.`);
    });

  agents
    .command('enable')
    .argument('<id>', 'Agent ID')
    .description('Enable an agent')
    .action(async (id) => {
      const client = createClient();
      const agent = await safeCall(() => client.query('agents:getByAgentId' as any, { id }), 'Failed to fetch agent');
      if (!agent) { error(`Agent "${id}" not found.`); process.exit(1); }
      await safeCall(() => client.mutation('agents:update' as any, { _id: (agent as any)._id, isActive: true }), 'Failed');
      success(`Agent "${id}" enabled.`);
    });

  agents
    .command('disable')
    .argument('<id>', 'Agent ID')
    .description('Disable an agent')
    .action(async (id) => {
      const client = createClient();
      const agent = await safeCall(() => client.query('agents:getByAgentId' as any, { id }), 'Failed to fetch agent');
      if (!agent) { error(`Agent "${id}" not found.`); process.exit(1); }
      await safeCall(() => client.mutation('agents:update' as any, { _id: (agent as any)._id, isActive: false }), 'Failed');
      success(`Agent "${id}" disabled.`);
    });
}
