import type { A2ATask, A2AResult, A2AServerConfig } from './a2a-types.js';
import type { Agent } from '../agent.js';

const AGENT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const DEFAULT_MAX_INSTRUCTION_LENGTH = 10_000;

function isValidAgentId(id: unknown): id is string {
  return typeof id === 'string' && AGENT_ID_RE.test(id);
}

function validateTask(task: unknown, maxInstructionLength: number): A2ATask {
  if (typeof task !== 'object' || task === null) {
    throw new Error('Task must be a JSON object.');
  }

  const t = task as Record<string, unknown>;

  if (typeof t['id'] !== 'string' || t['id'].length === 0) {
    throw new Error('Task missing required field: id');
  }
  if (!isValidAgentId(t['from'])) {
    throw new Error('Task field "from" must be a valid agent ID.');
  }
  if (!isValidAgentId(t['to'])) {
    throw new Error('Task field "to" must be a valid agent ID.');
  }
  if (typeof t['instruction'] !== 'string' || t['instruction'].length === 0) {
    throw new Error('Task missing required field: instruction');
  }
  if (t['instruction'].length > maxInstructionLength) {
    throw new Error(`Task instruction exceeds maximum length of ${maxInstructionLength} characters.`);
  }
  if (typeof t['createdAt'] !== 'number') {
    throw new Error('Task missing required field: createdAt');
  }

  return t as unknown as A2ATask;
}

export class A2AServer {
  private readonly maxInstructionLength: number;
  private readonly requireAuth: boolean;
  private readonly allowedAgents: Set<string> | null;

  constructor(
    private readonly agent: Agent,
    private readonly config: A2AServerConfig = {}
  ) {
    this.maxInstructionLength = config.maxInstructionLength ?? DEFAULT_MAX_INSTRUCTION_LENGTH;
    this.requireAuth = config.requireAuth ?? false;
    this.allowedAgents =
      config.allowedAgents && config.allowedAgents.length > 0
        ? new Set(config.allowedAgents)
        : null;
  }

  async handleTask(task: A2ATask): Promise<A2AResult> {
    const start = performance.now();

    try {
      // Whitelist check
      if (this.allowedAgents && !this.allowedAgents.has(task.from)) {
        return {
          taskId: task.id,
          status: 'error',
          output: `Agent "${task.from}" is not in the allowed agents list.`,
          durationMs: performance.now() - start,
        };
      }

      const response = await this.agent.generate(task.instruction);
      const durationMs = performance.now() - start;

      return {
        taskId: task.id,
        status: 'success',
        output: response.text,
        durationMs,
      };
    } catch (err) {
      return {
        taskId: task.id,
        status: 'error',
        output: err instanceof Error ? err.message : String(err),
        durationMs: performance.now() - start,
      };
    }
  }

  createHandler(): (req: Request) => Promise<Response> {
    return async (req: Request): Promise<Response> => {
      // Auth check
      if (this.requireAuth) {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: missing or invalid Authorization header.' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON body.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let task: A2ATask;
      try {
        task = validateTask(body, this.maxInstructionLength);
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const result = await this.handleTask(task);
      const status = result.status === 'success' ? 200 : result.status === 'timeout' ? 408 : 500;

      return new Response(JSON.stringify(result), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }
}
