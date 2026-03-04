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
    .option('--no-stream', 'Disable streaming (wait for full response)')
    .description('Start an interactive chat session with an agent')
    .action(async (agentId, opts) => {
      const client = await createClient();
      
      // Get Convex site URL for streaming
      const siteUrl = process.env.CONVEX_SITE_URL || process.env.CONVEX_URL?.replace('.cloud', '.site');
      const enableStreaming = !!siteUrl && opts.stream !== false;

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

      // SPEC-016 Task 3: Show sandbox warning if agent has sandbox enabled
      if (a.sandboxEnabled && a.sandboxImage) {
        console.log();
        console.log(`${colors.yellow}⚠  Agent has Docker Sandbox enabled (image: ${a.sandboxImage})${colors.reset}`);
        console.log(`${colors.dim}   To execute with full sandbox isolation, run:${colors.reset}`);
        console.log(`${colors.cyan}   agentforge sandbox run ${a.id} --message "your message"${colors.reset}`);
        console.log();
      }

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
      if (enableStreaming) {
        dim(`  Streaming: ${colors.green}enabled${colors.reset}`);
      } else {
        dim(`  Streaming: ${colors.yellow}disabled${colors.reset}`);
      }
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
        if (enableStreaming && siteUrl) {
          // AGE-173: SSE Streaming
          try {
            const response = await fetch(`${siteUrl}/stream-agent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agentId: a.id,
                message: input,
                threadId,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(errorText || `HTTP ${response.status}`);
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    if (data.token) {
                      process.stdout.write(data.token);
                      fullContent += data.token;
                    }
                    
                    if (data.error) {
                      console.log(`\n${colors.yellow}[Error: ${data.error}]${colors.reset}`);
                    }
                  } catch {
                    // Skip malformed SSE lines
                  }
                }
              }
            }

            console.log(); // Newline after streaming
            history.push({ role: 'assistant', content: fullContent });
          } catch (err) {
            console.log(`${colors.yellow}[Streaming failed: ${err instanceof Error ? err.message : String(err)}]${colors.reset}`);
            console.log(`${colors.yellow}[Falling back to non-streaming...]${colors.reset}`);
            
            // Fallback to non-streaming
            const response = await safeCall(
              () => client.action('mastraIntegration:executeAgent' as any, { agentId: a.id, prompt: input, threadId }),
              'Failed to get response'
            );
            const text = (response as any)?.response || (response as any)?.text || (response as any)?.content || String(response);
            console.log(text);
            history.push({ role: 'assistant', content: text });
          }
        } else {
          // Non-streaming fallback
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
