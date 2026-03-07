import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { loadProjectConfig } from '../lib/project-config.js';
import { header, success, error, info, dim, colors } from '../lib/display.js';

export function registerWorkflowsCommand(program: Command) {
  const workflowsCmd = program
    .command('workflows')
    .description('Multi-agent workflow commands');

  workflowsCmd
    .command('create')
    .description('Create a new workflow')
    .option('--name <name>', 'Workflow name')
    .option('--agent <id>', 'Agent ID to assign')
    .option('--trigger <type>', 'Trigger type (manual, cron, webhook)', 'manual')
    .option('--schedule <cron>', 'Cron schedule (for cron trigger)')
    .action(async (opts) => {
      const name = opts.name;
      const agent = opts.agent;
      const trigger = opts.trigger || 'manual';
      const schedule = opts.schedule;

      if (!name) {
        error('--name is required');
        process.exit(1);
      }

      if (!agent) {
        error('--agent is required');
        process.exit(1);
      }

      if (trigger === 'cron' && !schedule) {
        error('--schedule is required for cron triggers');
        process.exit(1);
      }

      const client = await createClient();

      // Build triggers JSON based on trigger type
      let triggersData: any = { type: trigger };
      if (trigger === 'cron' && schedule) {
        triggersData.schedule = schedule;
      }

      await safeCall(
        () => client.mutation('workflows:create' as any, {
          name,
          triggers: JSON.stringify(triggersData),
          steps: JSON.stringify([{ agentId: agent, name: 'Step 1' }]),
        }),
        'Failed to create workflow'
      );

      success(`Workflow "${name}" created`);
    });

  workflowsCmd
    .command('list')
    .option('-p, --project <projectId>', 'Filter by project ID')
    .option('--active', 'Show only active workflows')
    .option('--inactive', 'Show only inactive workflows')
    .description('List workflow definitions')
    .action(async (opts) => {
      const client = await createClient();

      const args: Record<string, any> = {};
      if (opts.project) args.projectId = opts.project;
      if (opts.active) args.isActive = true;
      if (opts.inactive) args.isActive = false;

      const workflows = await safeCall(
        () => client.query('workflows:list' as any, args),
        'Failed to fetch workflows'
      );

      if (!workflows || (workflows as any[]).length === 0) {
        info('No workflows found');
        return;
      }

      header('Workflows');
      (workflows as any[]).forEach((w: any) => {
        const statusColor = w.isActive ? colors.green : colors.dim;
        console.log(`  ${statusColor}●${colors.reset} ${w.name} ${colors.dim}(${w._id})${colors.reset}`);
        if (w.description) {
          console.log(`    ${dim(w.description)}`);
        }
        console.log();
      });
    });

  workflowsCmd
    .command('runs')
    .option('-w, --workflow <workflowId>', 'Filter by workflow ID')
    .option('-s, --status <status>', 'Filter by status (pending, running, completed, failed)')
    .option('-p, --project <projectId>', 'Filter by project ID')
    .description('List workflow runs')
    .action(async (opts) => {
      const client = await createClient();

      const args: Record<string, any> = {};
      if (opts.workflow) args.workflowId = opts.workflow;
      if (opts.status) args.status = opts.status;
      if (opts.project) args.projectId = opts.project;

      const runs = await safeCall(
        () => client.query('workflows:listRuns' as any, args),
        'Failed to fetch workflow runs'
      );

      if (!runs || (runs as any[]).length === 0) {
        info('No workflow runs found');
        return;
      }

      header('Workflow Runs');
      (runs as any[]).forEach((r: any) => {
        const statusColors: Record<string, string> = {
          pending: colors.yellow,
          running: colors.blue,
          completed: colors.green,
          failed: colors.red,
          suspended: colors.dim,
        };
        const statusColor = statusColors[r.status] || colors.dim;
        console.log(`  ${statusColor}●${colors.reset} ${r.workflowId} ${statusColor}(${r.status})${colors.reset}`);
        console.log(`    ${dim(`Run ID: ${r._id}`)}`);
        if (r.input) {
          console.log(`    ${dim(`Input: "${r.input.substring(0, 60)}${r.input.length > 60 ? '...' : ''}"`)}`);
        }
        console.log();
      });
    });

  workflowsCmd
    .command('run')
    .argument('<workflowId>', 'Workflow definition ID to run')
    .option('-i, --input <text>', 'Initial input for the workflow')
    .description('Execute a workflow')
    .action(async (workflowId, opts) => {
      const client = await createClient();

      header(`Running Workflow: ${workflowId}`);

      try {
        // Create the workflow run
        const runId = await safeCall(
          () => client.mutation('workflows:createRun' as any, {
            workflowId,
            input: opts.input,
          }),
          'Failed to create workflow run'
        );

        success(`Created run: ${colors.cyan}${runId}${colors.reset}`);
        dim('Dispatching workflow to the daemon...');

        const projectConfig = await loadProjectConfig(process.cwd());
        const port = projectConfig?.channels?.http?.port ?? 3001;

        const response = await fetch(`http://localhost:${port}/v1/workflows/runs/${runId}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.AGENTFORGE_API_KEY
              ? { Authorization: `Bearer ${process.env.AGENTFORGE_API_KEY}` }
              : {}),
          },
        });

        const result = await response.json() as { status?: string; output?: string; error?: string };
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.error ?? `Daemon returned HTTP ${response.status}`);
        }

        success('Workflow completed successfully');
        if (result.output) {
          console.log();
          dim('Output:');
          console.log(`  ${result.output}`);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        error(`Workflow execution failed: ${errMsg}`);
        process.exit(1);
      }
    });

  workflowsCmd
    .command('steps')
    .argument('<runId>', 'Workflow run ID')
    .description('Show steps for a workflow run')
    .action(async (runId) => {
      const client = await createClient();

      const steps = await safeCall(
        () => client.query('workflows:getRunSteps' as any, { runId }),
        'Failed to fetch workflow steps'
      );

      if (!steps || (steps as any[]).length === 0) {
        info('No steps found for this run');
        return;
      }

      header(`Workflow Steps: ${runId}`);
      (steps as any[]).forEach((s: any, i: number) => {
        const statusColors: Record<string, string> = {
          pending: colors.yellow,
          running: colors.blue,
          completed: colors.green,
          failed: colors.red,
          skipped: colors.dim,
          suspended: colors.dim,
        };
        const statusColor = statusColors[s.status] || colors.dim;
        console.log(`  ${i + 1}. ${s.name} ${statusColor}(${s.status})${colors.reset}`);
        if (s.input) {
          console.log(`     ${dim(`Input: "${s.input.substring(0, 50)}${s.input.length > 50 ? '...' : ''}"`)}`);
        }
        if (s.output) {
          console.log(`     ${dim(`Output: "${s.output.substring(0, 50)}${s.output.length > 50 ? '...' : ''}"`)}`);
        }
        if (s.error) {
          console.log(`     ${colors.red}Error: ${s.error}${colors.reset}`);
        }
        console.log();
      });
    });
}
