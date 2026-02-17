import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CloudClient,
  CloudAPIError,
  transformAgentConfig,
  transformToAgentConfig,
  DEFAULT_CLOUD_URL,
  type AgentConfig,
  type CloudAgent,
  type Deployment,
} from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CloudClient', () => {
  const apiKey = 'cloud_sk_test123456789';
  let client: CloudClient;

  beforeEach(() => {
    client = new CloudClient({ apiKey });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      const c = new CloudClient({ apiKey });
      expect(c).toBeInstanceOf(CloudClient);
    });

    it('should use default cloud URL', () => {
      const c = new CloudClient({ apiKey });
      expect(c).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const customUrl = 'https://staging.cloud.agentforge.io';
      const c = new CloudClient({ apiKey, baseUrl: customUrl });
      expect(c).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should validate API key format', async () => {
      const invalidClient = new CloudClient({ apiKey: 'invalid_key' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ deployments: [] }),
      } as Response);

      await expect(invalidClient.authenticate()).rejects.toThrow(CloudAPIError);
      await expect(invalidClient.authenticate()).rejects.toThrow('Invalid API key format');
    });

    it('should throw on missing API key', async () => {
      const noKeyClient = new CloudClient({ apiKey: '' });
      await expect(noKeyClient.authenticate()).rejects.toThrow('API key is required');
    });

    it('should authenticate successfully with valid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ deployments: [] }),
      } as Response);

      await expect(client.authenticate()).resolves.toBeUndefined();
    });

    it('should throw on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Unauthorized', message: 'Invalid token' }),
      } as Response);

      await expect(client.authenticate()).rejects.toThrow('Invalid API key');
    });
  });

  describe('createAgent', () => {
    const agentConfig: AgentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      model: 'gpt-4o',
      instructions: 'You are a helpful assistant.',
      tools: [{ name: 'search', description: 'Search the web' }],
    };

    it('should create agent successfully', async () => {
      const cloudAgent: CloudAgent = {
        agentId: 'test-agent',
        name: 'Test Agent',
        provider: 'openai',
        model: 'gpt-4o',
        systemPrompt: 'You are a helpful assistant.',
        tools: [{ name: 'search', description: 'Search the web' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => cloudAgent,
      } as Response);

      const result = await client.createAgent(agentConfig);
      expect(result).toEqual(cloudAgent);
    });

    it('should include authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      } as Response);

      await client.createAgent(agentConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${apiKey}`,
          }),
        })
      );
    });

    it('should throw CloudAPIError on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Bad Request', message: 'Invalid agent config' }),
      } as Response);

      await expect(client.createAgent(agentConfig)).rejects.toThrow(CloudAPIError);
    });
  });

  describe('deployCLIProject', () => {
    const project = {
      name: 'my-project',
      version: '1.0.0',
      agents: [
        {
          id: 'agent-1',
          name: 'Agent One',
          model: 'gpt-4o',
          instructions: 'Hello',
        },
      ],
      env: { API_KEY: 'secret' },
    };

    it('should deploy project successfully', async () => {
      const deployment: Deployment = {
        id: 'dep-123',
        agentId: 'agent-1',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => deployment,
      } as Response);

      const result = await client.deployCLIProject(project);
      expect(result.id).toBe('dep-123');
      expect(result.status).toBe('pending');
    });

    it('should transform agents before sending', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 'dep-123', status: 'pending', createdAt: '', updatedAt: '' }),
      } as Response);

      await client.deployCLIProject(project);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.agents[0]).toHaveProperty('agentId');
      expect(body.agents[0]).toHaveProperty('provider');
      expect(body.agents[0]).toHaveProperty('systemPrompt');
    });
  });

  describe('getDeploymentStatus', () => {
    it('should return deployment status', async () => {
      const deployment: Deployment = {
        id: 'dep-123',
        agentId: 'agent-1',
        status: 'ready',
        url: 'https://cloud.agentforge.io/agents/agent-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:01:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => deployment,
      } as Response);

      const result = await client.getDeploymentStatus('dep-123');
      expect(result.status).toBe('ready');
      expect(result.url).toBe('https://cloud.agentforge.io/agents/agent-1');
    });

    it('should throw on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Not Found', message: 'Deployment not found' }),
      } as Response);

      await expect(client.getDeploymentStatus('dep-123')).rejects.toThrow('Deployment not found');
    });
  });

  describe('listDeployments', () => {
    it('should return list of deployments', async () => {
      const deployments: Deployment[] = [
        {
          id: 'dep-1',
          agentId: 'agent-1',
          status: 'ready',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'dep-2',
          agentId: 'agent-2',
          status: 'failed',
          error: 'Build failed',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ deployments }),
      } as Response);

      const result = await client.listDeployments();
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('ready');
      expect(result[1].error).toBe('Build failed');
    });

    it('should return empty array when no deployments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ deployments: [] }),
      } as Response);

      const result = await client.listDeployments();
      expect(result).toEqual([]);
    });
  });
});

describe('transformAgentConfig', () => {
  it('should transform openai model with colon format', () => {
    const config: AgentConfig = {
      id: 'my-agent',
      name: 'My Agent',
      model: 'openai:gpt-4o',
      instructions: 'Be helpful',
    };

    const result = transformAgentConfig(config);
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o');
    expect(result.agentId).toBe('my-agent');
    expect(result.systemPrompt).toBe('Be helpful');
  });

  it('should transform anthropic model with slash format', () => {
    const config: AgentConfig = {
      id: 'claude-agent',
      name: 'Claude Agent',
      model: 'anthropic/claude-3-opus',
      instructions: 'Be helpful',
    };

    const result = transformAgentConfig(config);
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-3-opus');
  });

  it('should default to openai for model without prefix', () => {
    const config: AgentConfig = {
      id: 'simple-agent',
      name: 'Simple Agent',
      model: 'gpt-4o-mini',
      instructions: 'Be helpful',
    };

    const result = transformAgentConfig(config);
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('should preserve tools', () => {
    const config: AgentConfig = {
      id: 'tool-agent',
      name: 'Tool Agent',
      model: 'gpt-4o',
      instructions: 'Use tools',
      tools: [
        { name: 'calculator', description: 'Calculate', parameters: { type: 'object' } },
      ],
    };

    const result = transformAgentConfig(config);
    expect(result.tools).toHaveLength(1);
    expect(result.tools![0].name).toBe('calculator');
  });

  it('should handle empty tools array', () => {
    const config: AgentConfig = {
      id: 'no-tools',
      name: 'No Tools',
      model: 'gpt-4o',
      instructions: 'Just chat',
      tools: [],
    };

    const result = transformAgentConfig(config);
    expect(result.tools).toEqual([]);
  });
});

describe('transformToAgentConfig', () => {
  it('should transform CloudAgent back to AgentConfig', () => {
    const cloudAgent: CloudAgent = {
      agentId: 'my-agent',
      name: 'My Agent',
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'Be helpful',
      tools: [{ name: 'search' }],
    };

    const result = transformToAgentConfig(cloudAgent);
    expect(result.id).toBe('my-agent');
    expect(result.model).toBe('openai/gpt-4o');
    expect(result.instructions).toBe('Be helpful');
  });
});

describe('CloudAPIError', () => {
  it('should create error with message and status code', () => {
    const error = new CloudAPIError('Something went wrong', 500);
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('CloudAPIError');
  });

  it('should include error code when provided', () => {
    const error = new CloudAPIError('Bad request', 400, 'INVALID_INPUT');
    expect(error.code).toBe('INVALID_INPUT');
  });
});
