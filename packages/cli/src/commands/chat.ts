import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, success, error, info, dim, colors } from '../lib/display.js';
import readline from 'node:readline';

const MAX_MESSAGE_LENGTH = 10000;

function validateMessage(msg: string | undefined): { valid: boolean; error?: string } {
  if (!msg) return { valid: false, error: 'Message is required' };
  const trimmed = msg.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Message cannot be empty' };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
  }
  return { valid: true };
}

export function registerChatCommand(program: Command) {
  program
    .command('chat')
    .argument('[agent-id]', 'Agent ID to chat with')
    .option('-s, --session <id>', 'Resume an existing session')
    .option('--message <text>', 'Send a single message and exit (non-interactive)')
    .description('Start an interactive chat session with an agent')
    .action(async (agentId, opts) => {
      const client = await createClient();

      if (!agentId && !opts.session) {
        const agents = await safeCall(() => client.query('agents:list' as any, {}), 'Failed to list agents');
        if (!agents || (agents as any[]).length === 0) {
          error('No agents found. Create one first: agentforge agents create');
          process.exit(1);
        }
        header('Available Agents');
        (agents as any[]).forEach((a: any, i: number) => {
          console.log(`  ${colors.cyan}${i + 1}.${colors.reset} ${a.name} ${colors.dim}(${a.id})${colors.reset}`);
        });
        console.log();
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        const choice = await new Promise<string>((r) => rl2.question('Select agent (number or ID): ', (a) => { rl2.close(); r(a.trim()); }));
        const idx = parseInt(choice) - 1;
        agentId = idx >= 0 && idx < (agents as any[]).length ? (agents as any[])[idx].id : choice;
      }

      const agent = await safeCall(() => client.query('agents:get' as any, { id: agentId }), 'Failed to fetch agent');
      if (!agent) { error(`Agent "${agentId}" not found.`); process.exit(1); }

      const a = agent as any;

      // One-shot --message mode (non-interactive)
      if (opts.message) {
        const validation = validateMessage(opts.message);
        if (!validation.valid) {
          error(validation.error || 'Invalid message');
          process.exit(1);
        }

        const input = opts.message.trim();
        
        let threadId = await safeCall(
          () => client.mutation('threads:create' as any, { agentId: a.id }),
          'Failed to create thread'
        );

        await safeCall(() => client.mutation('messages:add' as any, { threadId, role: 'user', content: input }), 'Failed to send');

        try {
          const response = await safeCall(
            () => client.action('mastraIntegration:executeAgent' as any, { agentId: a.id, prompt: input, threadId }),
            'Failed to get response'
          );
          const text = (response as any)?.response || (response as any)?.text || (response as any)?.content || String(response);
          console.log(text);
        } catch {
          console.log(`${colors.yellow}[Configure your LLM API key in .env to get responses]${colors.reset}`);
        }
        process.exit(0);
      }

      // Interactive mode
      header(`Chat with ${a.name}`);
      dim(`  Model: ${a.model} | Provider: ${a.provider || 'openai'}`);
      dim(`  Type "exit" or "quit" to end. "/new" for new thread. "/history" for messages.`);
      console.log();

      let threadId = await safeCall(
        () => client.mutation('threads:create' as any, { agentId: a.id }),
        'Failed to create thread'
      );

      const history: Array<{ role: string; content: string }> = [];
      
      // AGE-171: Detect TTY vs piped input
      const isTTY = process.stdin.isTTY ?? false;
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: isTTY ? process.stdout : undefined,
        terminal: isTTY,
        prompt: isTTY ? `${colors.green}You${colors.reset} > ` : undefined,
      });

      if (isTTY) rl.prompt();

      rl.on('line', async (line) => {
        const input = line.trim();
        
        // Skip empty input
        if (!input) {
          if (isTTY) rl.prompt();
          return;
        }
        
        // Validate message length
        if (input.length > MAX_MESSAGE_LENGTH) {
          error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
          if (isTTY) rl.prompt();
          return;
        }
        
        if (input === 'exit' || input === 'quit') {
          success('Session ended. Goodbye!');
          process.exit(0);
        }
        if (input === '/new') {
          threadId = await safeCall(() => client.mutation('threads:create' as any, { agentId: a.id }), 'Failed');
          history.length = 0;
          info('New thread started.');
          if (isTTY) rl.prompt();
          return;
        }
        if (input === '/history') {
          history.forEach((m) => {
            const prefix = m.role === 'user' ? `${colors.green}You${colors.reset}` : `${colors.cyan}${a.name}${colors.reset}`;
            console.log(`  ${prefix}: ${m.content}`);
          });
          if (history.length === 0) dim('  (no messages yet)');
          console.log();
          if (isTTY) rl.prompt();
          return;
        }

        history.push({ role: 'user', content: input });
        await safeCall(() => client.mutation('messages:add' as any, { threadId, role: 'user', content: input }), 'Failed to send');

        if (isTTY) {
          process.stdout.write(`${colors.cyan}${a.name}${colors.reset} > `);
        }
        try {
          const response = await safeCall(
            () => client.action('mastraIntegration:executeAgent' as any, { agentId: a.id, prompt: input, threadId }),
            'Failed to get response'
          );
          const text = (response as any)?.response || (response as any)?.text || (response as any)?.content || String(response);
          console.log(text);
          history.push({ role: 'assistant', content: text });
        } catch {
          console.log(`${colors.yellow}[Configure your LLM API key in .env to get responses]${colors.reset}`);
        }
        console.log();
        if (isTTY) rl.prompt();
      });

      rl.on('close', () => {
        if (isTTY) {
          console.log();
          info('Session ended.');
        }
        process.exit(0);
      });
    });
}
