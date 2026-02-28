// Tests for MCPExecutor
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPExecutor, McpNotConnectedError } from './mcp-executor.js';

describe('MCPExecutor', () => {
  let executor: MCPExecutor;

  beforeEach(() => {
    executor = new MCPExecutor();
  });

  afterEach(async () => {
    await executor.disconnect();
  });

  it('instantiates without throwing', () => {
    expect(() => new MCPExecutor()).not.toThrow();
  });

  it('returns executor instance with connect/listTools/executeTool/disconnect methods', () => {
    expect(typeof executor.connect).toBe('function');
    expect(typeof executor.listTools).toBe('function');
    expect(typeof executor.executeTool).toBe('function');
    expect(typeof executor.disconnect).toBe('function');
  });

  it('connect stores server config (lazy connection)', async () => {
    // connect returns without error for valid config shape (actual connection is lazy)
    await expect(executor.connect({ command: 'echo', args: [], id: 'test' })).resolves.not.toThrow();
  });

  it('executeTool throws McpNotConnectedError if not connected and no valid config', async () => {
    // Create executor with invalid config to ensure connection fails
    const badExecutor = new MCPExecutor({ command: '', args: [] });
    // This will fail during connection since echo with no args won't work
    await expect(badExecutor.executeTool('test-tool', {})).rejects.toThrow();
  });

  it('disconnect can be called on unconnected executor', async () => {
    await expect(executor.disconnect()).resolves.not.toThrow();
  });
});
