/**
 * AgentForge Chat Command
 *
 * Interactive chat with agents via HTTP streaming.
 * Replaces the broken Convex action approach with daemon HTTP endpoint.
 */

import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, success, error, info, dim, colors } from '../lib/display.js';
import readline from 'node:readline';

const MAX_MESSAGE_LENGTH = 10000;
const DEFAULT_PORT = 3001;

function validateMessage(msg: string | undefined): { valid: boolean; error?: string } {
  if (!msg) return { valid: false, error: 'Message is required' };
  const trimmed = msg.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Message cannot be empty' };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
  }
  return { valid: true };
}

/**
 * Send a message to the HTTP endpoint and get a streaming response.
 * When stream=false, buffers the full response and calls onChunk once.
 */
async function chatViaHttp(
  agentId: string,
  message: string,
  port: number,
  onChunk: (chunk: string) => void,
  onError?: (error: string) => void,
  stream = true
): Promise<void> {
  const response = await fetch(`http://localhost:${port}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: agentId,
      messages: [{ role: 'user', content: message }],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            if (stream) {
              onChunk(content);
            } else {
              buffered += content;
            }
          }

          const errorMsg = parsed.error;
          if (errorMsg && onError) {
            onError(String(errorMsg));
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  if (!stream && buffered) {
    onChunk(buffered);
  }
}

export function registerChatCommand(program: Command) {
  program
    .command('chat')
    .argument('[agent-id]', 'Agent ID to chat with')
    .option('-s, --session <id>', 'Resume an existing session (deprecated, use --thread)')
    .option('-m, --message <text>', 'Send a single message and exit (non-interactive)')
    .option('--thread <id>', 'Continue existing thread (stored in Convex)')
    .option('-p, --port <n>', 'Runtime HTTP port', String(DEFAULT_PORT))
    .option('--no-stream', 'Disable streaming (wait for full response)')
    .description('Start an interactive chat session with an agent')
    .action(async (agentId, opts) => {
      const port = parseInt(opts.port, 10);
      const client = await createClient();

      // Check if runtime is running
      let runtimeRunning = false;
      try {
        const healthResponse = await fetch(`http://localhost:${port}/health`);
        runtimeRunning = healthResponse.ok;
      } catch {
        runtimeRunning = false;
      }

      if (!runtimeRunning) {
        error('AgentForge daemon is not running.');
        info('Start it first: agentforge start');
        process.exit(1);
      }

      // Fetch agents from Convex
      if (!agentId) {
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
        const idx = parseInt(choice, 10) - 1;
        agentId = idx >= 0 && idx < (agents as any[]).length ? (agents as any[])[idx].id : choice;
      }

      const agent = await safeCall(() => client.query('agents:get' as any, { id: agentId }), 'Failed to fetch agent');
      if (!agent) {
        error(`Agent "${agentId}" not found.`);
        process.exit(1);
      }

      const a = agent as any;

      // Deprecation warning for --session
      if (opts.session) {
        console.warn(`${colors.yellow}  ⚠ Warning: --session is deprecated and will be removed in a future release. Use --thread instead.${colors.reset}`);
      }

      // One-shot --message mode (non-interactive)
      if (opts.message) {
        const validation = validateMessage(opts.message);
        if (!validation.valid) {
          error(validation.error || 'Invalid message');
          process.exit(1);
        }

        const input = opts.message.trim();

        // Save message to Convex for history
        try {
          let threadId = opts.thread || opts.session;
          if (!threadId) {
            threadId = await safeCall(
              () => client.mutation('threads:createThread' as any, { agentId: a.id }),
              'Failed to create thread'
            );
          }
          await safeCall(() => client.mutation('messages:add' as any, { threadId, role: 'user', content: input }), 'Failed to save message');
        } catch {
          // Non-fatal: continue with chat even if Convex save fails
        }

        try {
          let fullResponse = '';
          await chatViaHttp(
            a.id,
            input,
            port,
            (chunk) => {
              process.stdout.write(chunk);
              fullResponse += chunk;
            },
            (errorMsg) => {
              console.log(`\n${colors.yellow}[Error: ${errorMsg}]${colors.reset}`);
            },
            opts.stream !== false
          );
          console.log(); // Newline after response
          process.exit(0);
        } catch (err) {
          error(`Chat failed: ${err instanceof Error ? err.message : String(err)}`);
          info('Make sure the daemon is running: agentforge start');
          process.exit(1);
        }
      }

      // Interactive mode
      header(`Chat with ${a.name}`);
      dim(`  Model: ${a.model} | Provider: ${a.provider || 'openai'}`);
      dim(`  Runtime: http://localhost:${port}`);
      dim(`  Type "exit" or "quit" to end. "/new" for new thread.`);
      console.log();

      let threadId = opts.thread || opts.session;
      if (!threadId) {
        threadId = await safeCall(
          () => client.mutation('threads:createThread' as any, { agentId: a.id }),
          'Failed to create thread'
        );
      }

      const history: Array<{ role: string; content: string }> = [];
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

        if (!input) {
          if (isTTY) rl.prompt();
          return;
        }

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
          threadId = await safeCall(() => client.mutation('threads:createThread' as any, { agentId: a.id }), 'Failed');
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

        // Save to Convex
        try {
          await safeCall(() => client.mutation('messages:add' as any, { threadId, role: 'user', content: input }), 'Failed to save');
        } catch {
          // Non-fatal
        }

        if (isTTY) {
          process.stdout.write(`${colors.cyan}${a.name}${colors.reset} > `);
        }

        try {
          let fullResponse = '';
          await chatViaHttp(
            a.id,
            input,
            port,
            (chunk) => {
              process.stdout.write(chunk);
              fullResponse += chunk;
            },
            (errorMsg) => {
              console.log(`\n${colors.yellow}[Error: ${errorMsg}]${colors.reset}`);
            },
            opts.stream !== false
          );
          console.log();
          history.push({ role: 'assistant', content: fullResponse });

          // Save assistant response to Convex
          try {
            await safeCall(() => client.mutation('messages:add' as any, { threadId, role: 'assistant', content: fullResponse }), 'Failed to save');
          } catch {
            // Non-fatal
          }
        } catch (err) {
          console.log(`${colors.yellow}[Chat failed: ${err instanceof Error ? err.message : String(err)}]${colors.reset}`);
          console.log(`${colors.yellow}[Check that the daemon is running: agentforge start]${colors.reset}`);
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
