import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpChannel } from '../src/channels/http.js';

function getApp(channel: HttpChannel) {
  return (channel as unknown as { app: { request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } }).app;
}

describe('HttpChannel dashboard compatibility routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://api.openai.com/v1/models') {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'gpt-5.4-pro' },
              { id: 'gpt-5.4' },
              { id: 'gpt-5.3-chat-latest' },
              { id: 'gpt-5.3-codex' },
              { id: 'gpt-5.2' },
              { id: 'gpt-5.2-chat-latest' },
              { id: 'gpt-5.2-codex' },
              { id: 'gpt-5.1' },
              { id: 'gpt-5.1-chat-latest' },
              { id: 'gpt-5.1-codex-mini' },
              { id: 'o3' },
              { id: 'o4-mini' },
              { id: 'text-embedding-3-small' },
              { id: 'gpt-5.4-2026-03-05' },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: [
            { id: 'openai/gpt-5.4-pro' },
            { id: 'openai/gpt-5.4' },
            { id: 'openai/gpt-5.3-codex' },
            { id: 'openai/gpt-5.2' },
            { id: 'openai/gpt-5.2-codex' },
            { id: 'qwen/qwen3-coder' },
            { id: 'qwen/qwen3-max' },
            { id: 'qwen/qwen3-235b-a22b' },
            { id: 'anthropic/claude-opus-4.6' },
            { id: 'anthropic/claude-sonnet-4.6' },
            { id: 'anthropic/claude-haiku-4.5' },
            { id: 'google/gemini-3.1-pro-preview' },
            { id: 'google/gemini-3-flash-preview' },
            { id: 'google/gemini-3.1-flash-lite-preview' },
          ],
        }),
      } as Response;
    }));
  });

  it('returns a provider catalog from /api/models with current-generation models', async () => {
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:4173'],
    });

    const response = await getApp(channel).request('http://localhost/api/models', {
      headers: {
        Origin: 'http://localhost:4173',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4173');

    const body = await response.json() as {
      providers: Array<{ id: string; models: string[] }>;
    };

    const openai = body.providers.find((provider) => provider.id === 'openai');
    const google = body.providers.find((provider) => provider.id === 'google');
    const openrouter = body.providers.find((provider) => provider.id === 'openrouter');

    expect(openai?.models).toEqual(expect.arrayContaining(['gpt-5.1', 'gpt-5.1-chat-latest', 'gpt-5.1-codex-mini', 'gpt-5.4']));
    expect(openai?.models).not.toContain('gpt-4.1-mini');
    expect(openai?.models).not.toContain('gpt-5.1-mini');
    expect(openai?.models).not.toContain('gpt-5.2-chat');
    expect(openai?.models).not.toContain('text-embedding-3-small');
    expect(google?.models).toEqual(expect.arrayContaining(['gemini-3.1-pro-preview', 'gemini-3-flash-preview']));
    expect(openrouter?.models).toEqual(expect.arrayContaining(['openrouter/auto', 'openai/gpt-5.4', 'qwen/qwen3-coder']));
  });

  it('persists dashboard chat messages through /api/chat and returns the assistant reply', async () => {
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ text: 'Assistant reply' }),
    };
    const dataClient = {
      query: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'threads:getThread') {
          return { _id: 'nd76tnamzzrnxye4wn2ry24j0s82fthc' };
        }
        if (name === 'messages:getByThread') {
          return [];
        }
        return null;
      }),
      mutation: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'sessions:create') return 'session-doc-id';
        if (name === 'messages:create') return 'message-doc-id';
        return null;
      }),
    };
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:4173'],
      dataClient,
    });

    (channel as unknown as {
      daemon: {
        listAgents: () => Array<{ id: string; name: string; instructions: string; model: string }>;
        listAgentIds: () => string[];
        getAgent: (id: string) => unknown;
        getOrLoadAgentDefinition: (id: string) => Promise<{ agent: unknown; definition: { id: string; name: string; instructions: string; model: string } } | null>;
        executeWorkflowRun: (id: string) => Promise<{ runId: string; status: 'success' | 'failed' }>;
      };
    }).daemon = {
      listAgents: () => [{ id: 'assistant', name: 'Assistant', instructions: 'Help.', model: 'openai/gpt-5.2' }],
      listAgentIds: () => ['assistant'],
      getAgent: () => mockAgent,
      getOrLoadAgentDefinition: async () => ({
        agent: mockAgent,
        definition: { id: 'assistant', name: 'Assistant', instructions: 'Help.', model: 'openai/gpt-5.2' },
      }),
      executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
    };

    const response = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:4173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: 'assistant',
        threadId: 'nd76tnamzzrnxye4wn2ry24j0s82fthc',
        message: 'Hello from the dashboard',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4173');

    const body = await response.json() as {
      threadId: string;
      sessionId: string;
      message: { role: string; content: string };
    };

    expect(body.threadId).toBe('nd76tnamzzrnxye4wn2ry24j0s82fthc');
    expect(body.sessionId).toMatch(/^session_/);
    expect(body.message).toEqual({ role: 'assistant', content: 'Assistant reply' });
    expect(mockAgent.generate).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      maxSteps: 8,
      toolChoice: 'auto',
    }));
    expect(dataClient.query).toHaveBeenCalledWith('threads:getThread', { threadId: 'nd76tnamzzrnxye4wn2ry24j0s82fthc' });
    expect(dataClient.query).toHaveBeenCalledWith('messages:getByThread', { threadId: 'nd76tnamzzrnxye4wn2ry24j0s82fthc' });
    expect(dataClient.mutation).toHaveBeenCalledWith('messages:create', expect.objectContaining({
      threadId: 'nd76tnamzzrnxye4wn2ry24j0s82fthc',
      role: 'user',
      content: 'Hello from the dashboard',
    }));
    expect(dataClient.mutation).toHaveBeenCalledWith('messages:create', expect.objectContaining({
      threadId: 'nd76tnamzzrnxye4wn2ry24j0s82fthc',
      role: 'assistant',
      content: 'Assistant reply',
    }));
    expect(dataClient.mutation).toHaveBeenCalledWith('usage:record', expect.objectContaining({
      agentId: 'assistant',
      provider: 'openai',
      model: 'gpt-5.2',
      cost: expect.any(Number),
    }));
    const usageCall = vi.mocked(dataClient.mutation).mock.calls.find(([name]) => name === 'usage:record');
    expect(usageCall?.[1]).toEqual(expect.objectContaining({
      cost: expect.any(Number),
    }));
    expect((usageCall?.[1] as { cost?: number } | undefined)?.cost).toBeGreaterThan(0);
  });

  it('injects attached text file contents into the dashboard chat prompt', async () => {
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ text: 'Attachment processed' }),
    };
    const dataClient = {
      query: vi.fn().mockImplementation(async (name: string, args: Record<string, unknown>) => {
        if (name === 'threads:getThread') {
          return { _id: 'nd76tnamzzrnxye4wn2ry24j0s82fthc' };
        }
        if (name === 'messages:getByThread') {
          return [];
        }
        if (name === 'files:getDownloadUrl') {
          expect(args.id).toBe('k57awsj8qzrqtevrbbt32ebbqs82eyra');
          return {
            url: 'https://files.example.test/agentforge-upload.txt',
            name: 'agentforge-upload.txt',
            mimeType: 'text/plain',
          };
        }
        return null;
      }),
      mutation: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'sessions:create') return 'session-doc-id';
        if (name === 'messages:create') return 'message-doc-id';
        return null;
      }),
    };

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://files.example.test/agentforge-upload.txt') {
        return {
          ok: true,
          text: async () => 'AgentForge uploaded file body',
          headers: new Headers({ 'content-type': 'text/plain; charset=utf-8' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    }));

    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:4173'],
      dataClient,
    });

    (channel as unknown as {
      daemon: {
        listAgents: () => Array<{ id: string; name: string; instructions: string; model: string }>;
        listAgentIds: () => string[];
        getAgent: (id: string) => unknown;
        getOrLoadAgentDefinition: (id: string) => Promise<{ agent: unknown; definition: { id: string; name: string; instructions: string; model: string } } | null>;
        executeWorkflowRun: (id: string) => Promise<{ runId: string; status: 'success' | 'failed' }>;
      };
    }).daemon = {
      listAgents: () => [{ id: 'assistant', name: 'Assistant', instructions: 'Help.', model: 'openai/gpt-5.2' }],
      listAgentIds: () => ['assistant'],
      getAgent: () => mockAgent,
      getOrLoadAgentDefinition: async () => ({
        agent: mockAgent,
        definition: { id: 'assistant', name: 'Assistant', instructions: 'Help.', model: 'openai/gpt-5.2' },
      }),
      executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
    };

    const response = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:4173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: 'assistant',
        threadId: 'nd76tnamzzrnxye4wn2ry24j0s82fthc',
        message: 'Please summarize the attachment.',
        fileIds: ['k57awsj8qzrqtevrbbt32ebbqs82eyra'],
      }),
    });

    expect(response.status).toBe(200);
    expect(dataClient.query).toHaveBeenCalledWith('files:getDownloadUrl', {
      id: 'k57awsj8qzrqtevrbbt32ebbqs82eyra',
    });
    expect(mockAgent.generate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Attached files:'),
        }),
      ]),
      expect.objectContaining({
        maxSteps: 8,
        toolChoice: 'auto',
      }),
    );
    const prompt = mockAgent.generate.mock.calls[0]?.[0]?.at(-1)?.content;
    expect(prompt).toContain('Please summarize the attachment.');
    expect(prompt).toContain('agentforge-upload.txt');
    expect(prompt).toContain('AgentForge uploaded file body');
    expect(prompt).not.toContain('Attached file IDs:');
  });

  it('hot-loads an agent definition when dashboard chat targets an agent created after daemon startup', async () => {
    const loadedAgent = {
      generate: vi.fn().mockResolvedValue({ text: 'Hot-loaded reply' }),
    };
    const dataClient = {
      query: vi.fn().mockResolvedValue([]),
      mutation: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'sessions:create') return 'session-doc-id';
        if (name === 'messages:create') return 'message-doc-id';
        return null;
      }),
    };
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:4173'],
      dataClient,
    });
    const getOrLoadAgentDefinition = vi.fn(async () => ({
      agent: loadedAgent,
        definition: {
          id: 'fresh-agent',
          name: 'Fresh Agent',
          instructions: 'Help.',
          model: 'openai/gpt-5.2-chat-latest',
        },
      }));

    (channel as unknown as {
      daemon: {
        listAgents: () => Array<{ id: string; name: string; instructions: string; model: string }>;
        listAgentIds: () => string[];
        getAgent: (id: string) => unknown;
        getOrLoadAgentDefinition: (id: string) => Promise<{ agent: unknown; definition: { id: string; name: string; instructions: string; model: string } } | null>;
        executeWorkflowRun: (id: string) => Promise<{ runId: string; status: 'success' | 'failed' }>;
      };
    }).daemon = {
      listAgents: () => [],
      listAgentIds: () => [],
      getAgent: () => undefined,
      getOrLoadAgentDefinition,
      executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
    };

    const response = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:4173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: 'fresh-agent',
        threadId: 'thread_456',
        message: 'Hot load this agent',
      }),
    });

    expect(response.status).toBe(200);
    expect(getOrLoadAgentDefinition).toHaveBeenCalledWith('fresh-agent');
    expect(loadedAgent.generate).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      maxSteps: 8,
      toolChoice: 'auto',
    }));
  });

  it('creates a real thread when dashboard chat sends a non-Convex threadId', async () => {
    const mockAgent = {
      generate: vi.fn().mockResolvedValue({ text: 'Recovered reply' }),
    };
    const dataClient = {
      query: vi.fn().mockImplementation(async (name: string, args: Record<string, unknown>) => {
        if (name === 'threads:getThread') {
          return null;
        }
        if (name === 'messages:getByThread') {
          expect(args.threadId).toBe('nd76tnamzzrnxye4wn2ry24j0s82fthc');
          return [];
        }
        return null;
      }),
      mutation: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'threads:createThread') return 'nd76tnamzzrnxye4wn2ry24j0s82fthc';
        if (name === 'sessions:create') return 'session-doc-id';
        if (name === 'messages:create') return 'message-doc-id';
        return null;
      }),
    };
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:4173'],
      dataClient,
    });

    (channel as unknown as {
      daemon: {
        listAgents: () => Array<{ id: string; name: string; instructions: string; model: string }>;
        listAgentIds: () => string[];
        getAgent: (id: string) => unknown;
        getOrLoadAgentDefinition: (id: string) => Promise<{ agent: unknown; definition: { id: string; name: string; instructions: string; model: string } } | null>;
        executeWorkflowRun: (id: string) => Promise<{ runId: string; status: 'success' | 'failed' }>;
      };
    }).daemon = {
      listAgents: () => [{ id: 'assistant', name: 'Assistant', instructions: 'Help.', model: 'openai/gpt-5.2' }],
      listAgentIds: () => ['assistant'],
      getAgent: () => mockAgent,
      getOrLoadAgentDefinition: async () => ({
        agent: mockAgent,
        definition: { id: 'assistant', name: 'Assistant', instructions: 'Help.', model: 'openai/gpt-5.2' },
      }),
      executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
    };

    const response = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:4173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: 'assistant',
        threadId: 'test-thread-smoke',
        message: 'Hello from the dashboard',
      }),
    });

    expect(response.status).toBe(200);

    const body = await response.json() as {
      threadId: string;
      sessionId: string;
      message: { role: string; content: string };
    };

    expect(body.threadId).toBe('nd76tnamzzrnxye4wn2ry24j0s82fthc');
    expect(body.sessionId).toMatch(/^session_/);
    expect(body.message).toEqual({ role: 'assistant', content: 'Recovered reply' });
    expect(mockAgent.generate).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      maxSteps: 8,
      toolChoice: 'auto',
    }));
    expect(dataClient.query).not.toHaveBeenCalledWith('threads:getThread', expect.anything());
    expect(dataClient.mutation).toHaveBeenCalledWith('threads:createThread', {
      agentId: 'assistant',
      name: 'Chat with Assistant',
    });
    expect(dataClient.mutation).toHaveBeenCalledWith('messages:create', expect.objectContaining({
      threadId: 'nd76tnamzzrnxye4wn2ry24j0s82fthc',
      role: 'user',
    }));
  });
});
