import type { A2ATask, A2AResult, A2AStreamChunk, A2AConstraints, A2AContext } from './a2a-types.js';
import type { A2AAgentRegistry } from './a2a-registry.js';

const AGENT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const MAX_INSTRUCTION_LENGTH = 10_000;

function validateAgentId(id: string, field: string): void {
  if (!AGENT_ID_RE.test(id)) {
    throw new Error(`Invalid ${field} "${id}": must be 1-128 alphanumeric characters, hyphens, or underscores.`);
  }
}

export class A2AClient {
  constructor(private readonly registry: A2AAgentRegistry) {}

  async delegate(task: {
    from: string;
    to: string;
    instruction: string;
    context?: A2AContext;
    constraints?: A2AConstraints;
    callbackUrl?: string;
  }): Promise<A2AResult> {
    validateAgentId(task.from, 'from');
    validateAgentId(task.to, 'to');

    if (!task.instruction || task.instruction.length === 0) {
      throw new Error('instruction must not be empty.');
    }
    if (task.instruction.length > MAX_INSTRUCTION_LENGTH) {
      throw new Error(`instruction exceeds maximum length of ${MAX_INSTRUCTION_LENGTH} characters.`);
    }

    const endpoint = this.registry.resolve(task.to);
    if (!endpoint) {
      throw new Error(`Agent "${task.to}" is not registered.`);
    }

    const a2aTask: A2ATask = {
      id: crypto.randomUUID(),
      from: task.from,
      to: task.to,
      instruction: task.instruction,
      context: task.context,
      constraints: task.constraints,
      callbackUrl: task.callbackUrl,
      createdAt: Date.now(),
    };

    const timeoutMs = task.constraints?.timeoutMs;
    const fetchPromise = this.sendTask(endpoint, a2aTask);

    if (timeoutMs != null && timeoutMs > 0) {
      const timeoutPromise = new Promise<A2AResult>((_, reject) => {
        setTimeout(() => reject(new Error('Task timed out')), timeoutMs);
      });
      try {
        return await Promise.race([fetchPromise, timeoutPromise]);
      } catch (err) {
        if (err instanceof Error && err.message === 'Task timed out') {
          return {
            taskId: a2aTask.id,
            status: 'timeout',
            durationMs: timeoutMs,
          };
        }
        throw err;
      }
    }

    return fetchPromise;
  }

  async *delegateStream(task: {
    from: string;
    to: string;
    instruction: string;
    context?: A2AContext;
    constraints?: A2AConstraints;
    callbackUrl?: string;
  }): AsyncGenerator<A2AStreamChunk> {
    validateAgentId(task.from, 'from');
    validateAgentId(task.to, 'to');

    if (!task.instruction || task.instruction.length === 0) {
      throw new Error('instruction must not be empty.');
    }
    if (task.instruction.length > MAX_INSTRUCTION_LENGTH) {
      throw new Error(`instruction exceeds maximum length of ${MAX_INSTRUCTION_LENGTH} characters.`);
    }

    const endpoint = this.registry.resolve(task.to);
    if (!endpoint) {
      throw new Error(`Agent "${task.to}" is not registered.`);
    }

    const a2aTask: A2ATask = {
      id: crypto.randomUUID(),
      from: task.from,
      to: task.to,
      instruction: task.instruction,
      context: task.context,
      constraints: task.constraints,
      callbackUrl: task.callbackUrl,
      createdAt: Date.now(),
    };

    const streamEndpoint = endpoint.replace(/\/?$/, '/stream');
    const response = await fetch(streamEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a2aTask),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Streaming request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(trimmed.slice(6)) as A2AStreamChunk;
              yield chunk;
            } catch (error) {
              console.debug('[A2AClient.sendTaskStreaming] Skipping malformed SSE line:', error instanceof Error ? error.message : error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async sendTask(endpoint: string, task: A2ATask): Promise<A2AResult> {
    const startTime = performance.now();

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
    } catch (err) {
      const durationMs = performance.now() - startTime;
      return {
        taskId: task.id,
        status: 'error',
        output: err instanceof Error ? err.message : String(err),
        durationMs,
      };
    }

    const durationMs = performance.now() - startTime;

    if (!response.ok) {
      return {
        taskId: task.id,
        status: 'error',
        output: `Remote agent returned HTTP ${response.status}`,
        durationMs,
      };
    }

    const result = (await response.json()) as A2AResult;
    return { ...result, durationMs };
  }
}
