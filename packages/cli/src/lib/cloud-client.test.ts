import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudClient, CloudClientError } from './cloud-client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Helper to create mock response
function createMockResponse(options: {
  ok: boolean;
  status: number;
  json?: () => Promise<any>;
  text?: () => Promise<string>;
}): Response {
  return {
    ok: options.ok,
    status: options.status,
    headers: {
      get: (name: string) => {
        if (name === 'content-type') return 'application/json';
        return null;
      },
    },
    json: options.json || (async () => ({} as any)),
    text: options.text || (async () => ''),
  } as Response;
}

describe('CloudClient', () => {
  let client: CloudClient;

  beforeEach(() => {
    client = new CloudClient('https://cloud.agentforge.ai', 'test-api-key');
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create a client with default values', () => {
      const c = new CloudClient();
      expect(c).toBeDefined();
    });

    it('should create a client with custom values', () => {
      const c = new CloudClient('https://custom.cloud.com', 'custom-key');
      expect(c).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test User' };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockUser,
      }));

      const result = await client.authenticate();

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/auth/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should throw CloudClientError when no API key', async () => {
      const c = new CloudClient('https://cloud.agentforge.ai');
      
      let error: Error | undefined;
      try {
        await c.authenticate();
      } catch (e) {
        error = e as Error;
      }
      
      expect(error).toBeInstanceOf(CloudClientError);
      expect(error?.message).toContain('No API key configured');
    });

    it('should throw CloudClientError on 401 response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid token' }),
      }));

      let error: Error | undefined;
      try {
        await client.authenticate();
      } catch (e) {
        error = e as Error;
      }
      
      expect(error).toBeInstanceOf(CloudClientError);
      expect(error?.message).toContain('Invalid');
    });

    it('should throw CloudClientError on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      let error: Error | undefined;
      try {
        await client.authenticate();
      } catch (e) {
        error = e as Error;
      }
      
      expect(error).toBeInstanceOf(CloudClientError);
      expect(error?.message).toContain('Network error');
    });
  });

  describe('listProjects', () => {
    it('should list projects', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'Project 1', createdAt: 1234567890 },
        { id: 'proj-2', name: 'Project 2', createdAt: 1234567890 },
      ];
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockProjects,
      }));

      const result = await client.listProjects();

      expect(result).toEqual(mockProjects);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/projects',
        expect.any(Object)
      );
    });
  });

  describe('getProject', () => {
    it('should get a project by ID', async () => {
      const mockProject = { id: 'proj-1', name: 'Project 1', createdAt: 1234567890 };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockProject,
      }));

      const result = await client.getProject('proj-1');

      expect(result).toEqual(mockProject);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/projects/proj-1',
        expect.any(Object)
      );
    });

    it('should throw error on 404', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Project not found' }),
      }));

      let error: Error | undefined;
      try {
        await client.getProject('nonexistent');
      } catch (e) {
        error = e as Error;
      }
      
      expect(error).toBeInstanceOf(CloudClientError);
    });
  });

  describe('createDeployment', () => {
    it('should create a deployment', async () => {
      const mockResponse = { deploymentId: 'dep-123', status: 'pending' };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      }));

      const result = await client.createDeployment({
        projectId: 'proj-1',
        agents: [{ name: 'Test Agent', instructions: 'Be helpful', model: 'gpt-4o' }],
        version: 'v1.0.0',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/deployments/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            projectId: 'proj-1',
            agents: [{ name: 'Test Agent', instructions: 'Be helpful', model: 'gpt-4o' }],
            version: 'v1.0.0',
          }),
        })
      );
    });
  });

  describe('getDeploymentStatus', () => {
    it('should get deployment status', async () => {
      const mockStatus = { id: 'dep-123', status: 'completed', url: 'https://example.com' };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockStatus,
      }));

      const result = await client.getDeploymentStatus('dep-123');

      expect(result).toEqual(mockStatus);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/deployments/dep-123/status',
        expect.any(Object)
      );
    });
  });

  describe('rollbackDeployment', () => {
    it('should rollback a deployment', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      }));

      const result = await client.rollbackDeployment('dep-123');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/deployments/dep-123/rollback',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('uploadAgentConfig', () => {
    it('should upload agent config', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ agentId: 'agent-123' }),
      }));

      const result = await client.uploadAgentConfig('proj-1', {
        name: 'Test Agent',
        instructions: 'Be helpful',
        model: 'gpt-4o',
      });

      expect(result).toEqual({ agentId: 'agent-123' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/projects/proj-1/agents',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Agent',
            instructions: 'Be helpful',
            model: 'gpt-4o',
          }),
        })
      );
    });
  });

  describe('URL handling', () => {
    it('should handle baseUrl with trailing slash', async () => {
      const c = new CloudClient('https://cloud.agentforge.ai/', 'test-key');
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user-1', email: 'test@example.com' }),
      }));

      await c.authenticate();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/auth/me',
        expect.any(Object)
      );
    });

    it('should handle endpoint without leading slash', async () => {
      const c = new CloudClient('https://cloud.agentforge.ai', 'test-key');
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => [],
      }));

      await c.listProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cloud.agentforge.ai/api/projects',
        expect.any(Object)
      );
    });
  });

  describe('setters', () => {
    it('should update apiKey with setApiKey', () => {
      const c = new CloudClient('https://cloud.agentforge.ai');
      c.setApiKey('new-key');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user-1', email: 'test@example.com' }),
      }));

      // This should not throw now
      c.authenticate();
    });

    it('should update baseUrl with setBaseUrl', async () => {
      const c = new CloudClient('https://old.cloud.com', 'test-key');
      c.setBaseUrl('https://new.cloud.com');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => [],
      }));

      c.listProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://new.cloud.com/api/projects',
        expect.any(Object)
      );
    });
  });
});
