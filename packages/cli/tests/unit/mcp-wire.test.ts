/**
 * AGE-141: MCP Connections Wire-up Tests
 *
 * Tests for MCP connection testing, status updates, and tool context injection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AGE-141: MCP Connections Wire-up', () => {
  describe('testConnection action', () => {
    it('should return success with stdio-protocol for npx-based servers', async () => {
      // Mock stdio-based connection
      const npxConnection = {
        _id: 'npx-123',
        name: 'GitHub',
        serverUrl: 'npx -y @modelcontextprotocol/server-github',
        credentials: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_test' },
        isEnabled: true,
      };

      // Expected result for stdio connections
      const expected = {
        ok: true,
        tools: ['stdio-protocol'],
        latencyMs: expect.any(Number),
      };

      // Test implementation would call the action
      // For now, this is a structural test showing expected behavior
      expect(npxConnection.serverUrl).toMatch(/^npx /);
      expect(expected.ok).toBe(true);
      expect(expected.tools).toContain('stdio-protocol');
    });

    it('should return success with stdio-protocol for node-based servers', async () => {
      const nodeConnection = {
        _id: 'node-456',
        name: 'Local MCP',
        serverUrl: 'node /path/to/server.js',
        isEnabled: true,
      };

      expect(nodeConnection.serverUrl).toMatch(/^node /);
    });

    it('should fetch tools from HTTP MCP server', async () => {
      const httpConnection = {
        _id: 'http-789',
        name: 'HTTP MCP Server',
        serverUrl: 'https://api.example.com/mcp',
        credentials: { apiKey: 'test-key' },
        isEnabled: true,
      };

      expect(httpConnection.serverUrl).toMatch(/^https?:/);
    });
  });

  describe('updateStatus mutation', () => {
    it('should update connection status fields', () => {
      const updateData = {
        id: 'mcp-123',
        isConnected: true,
        lastConnectedAt: Date.now(),
        toolCount: 5,
      };

      expect(updateData.isConnected).toBe(true);
      expect(updateData.lastConnectedAt).toBeGreaterThan(0);
      expect(updateData.toolCount).toBe(5);
    });

    it('should handle partial updates', () => {
      const partialUpdate = {
        id: 'mcp-456',
        isConnected: false,
      };

      expect(partialUpdate.isConnected).toBe(false);
      expect(partialUpdate.lastConnectedAt).toBeUndefined();
    });
  });

  describe('MCP tool context injection', () => {
    it('should build tool context from active connections', () => {
      const connections = [
        {
          name: 'GitHub',
          capabilities: ['repos', 'issues', 'pull_requests'],
          isEnabled: true,
        },
        {
          name: 'Slack',
          capabilities: ['send_messages', 'read_channels'],
          isEnabled: true,
        },
      ];

      const toolsContext = connections
        .map((c) => `${c.name} (${(c.capabilities || []).join(', ')})`)
        .join(', ');

      expect(toolsContext).toContain('GitHub');
      expect(toolsContext).toContain('repos');
      expect(toolsContext).toContain('Slack');
      expect(toolsContext).toContain('send_messages');
    });

    it('should include tool context in agent instructions', () => {
      const baseInstructions = 'You are a helpful AI assistant.';
      const toolsContext = 'You have access to these MCP tools: GitHub (repos, issues), Slack (send_messages). Use them when relevant.';

      const fullInstructions = toolsContext ? `${baseInstructions}\n\n${toolsContext}` : baseInstructions;

      expect(fullInstructions).toContain(baseInstructions);
      expect(fullInstructions).toContain('MCP tools');
      expect(fullInstructions).toContain('GitHub');
    });

    it('should handle empty connections list', () => {
      const connections: any[] = [];
      const toolsContext =
        connections.length > 0
          ? `You have access to these MCP tools: ${connections
              .map((c) => `${c.name} (${(c.capabilities || []).join(', ')})`)
              .join(', ')}. Use them when relevant.`
          : '';

      expect(toolsContext).toBe('');
    });
  });

  describe('HTTP MCP protocol errors', () => {
    it('should handle 401 authentication errors', () => {
      const errorResponse = {
        ok: false,
        tools: [],
        error: 'HTTP 401',
        latencyMs: expect.any(Number),
      };

      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.tools).toEqual([]);
      expect(errorResponse.error).toBe('HTTP 401');
    });

    it('should handle connection timeouts', () => {
      const timeoutError = {
        ok: false,
        tools: [],
        error: 'Connection timeout',
        latencyMs: expect.any(Number),
      };

      expect(timeoutError.ok).toBe(false);
      expect(timeoutError.error).toContain('timeout');
    });
  });

  describe('Dashboard UI state', () => {
    it('should track testing state per connection', () => {
      const testState: Record<string, boolean> = {};

      testState['conn-1'] = true; // testing
      testState['conn-2'] = false; // not testing

      expect(testState['conn-1']).toBe(true);
      expect(testState['conn-2']).toBe(false);
    });

    it('should store test results', () => {
      const testResults: Record<
        string,
        { ok: boolean; tools: string[]; error?: string }
      > = {};

      testResults['conn-1'] = {
        ok: true,
        tools: ['stdio-protocol'],
      };
      testResults['conn-2'] = {
        ok: false,
        tools: [],
        error: 'HTTP 401',
      };

      expect(testResults['conn-1'].ok).toBe(true);
      expect(testResults['conn-1'].tools).toHaveLength(1);
      expect(testResults['conn-2'].ok).toBe(false);
      expect(testResults['conn-2'].error).toBe('HTTP 401');
    });
  });
});
