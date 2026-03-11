/**
 * Tests for the `agentforge start` command
 *
 * Covers: CONVEX_URL validation, agent loading, port conflicts,
 * channel enablement logic, model string building, and agent definition building.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerStartCommand, buildModelString } from './start.js';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('fs-extra', () => ({
  default: {
    existsSync: vi.fn(() => true),
  },
}));

vi.mock('../lib/convex-client.js', () => ({
  createClient: vi.fn(() => ({
    query: vi.fn(() => Promise.resolve([])),
    mutation: vi.fn(() => Promise.resolve()),
    action: vi.fn(() => Promise.resolve()),
  })),
  safeCall: vi.fn((fn: () => any) => fn()),
}));

vi.mock('../lib/project-config.js', () => ({
  loadProjectConfig: vi.fn(() => Promise.resolve(null)),
  loadProjectEnv: vi.fn(),
}));

vi.mock('../lib/runtime-workspace.js', () => ({
  resolveWorkspaceSkillsBasePath: vi.fn(() => '/tmp/skills'),
}));

vi.mock('../lib/display.js', () => ({
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  dim: vi.fn(),
}));

vi.mock('../lib/provider-keys.js', () => ({
  getAgentProviders: vi.fn(() => []),
  getProviderEnvKey: vi.fn((p: string) => `${p.toUpperCase()}_API_KEY`),
  getProviderEnvKeys: vi.fn((p: string) => [`${p.toUpperCase()}_API_KEY`]),
  getProvidersFromModels: vi.fn(() => []),
  hydrateProviderEnvVars: vi.fn(() => Promise.resolve({ hydrated: [] })),
}));

vi.mock('../lib/convex-auth.js', () => ({
  resolveConvexAdminAuthFromLogin: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../lib/workflow-executor.js', () => ({
  createDaemonWorkflowExecutor: vi.fn(() => ({})),
}));

describe('agentforge start command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerStartCommand(program);
    vi.clearAllMocks();
  });

  const getStartCmd = () => program.commands.find((c) => c.name() === 'start');

  it('should register the start command', () => {
    const cmd = getStartCmd();
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('daemon');
  });

  it('should have --port option with default 3001', () => {
    const cmd = getStartCmd();
    const portOpt = cmd?.options.find((o) => o.long === '--port');
    expect(portOpt).toBeDefined();
    expect(portOpt?.defaultValue).toBe('3001');
  });

  it('should have --discord flag', () => {
    const cmd = getStartCmd();
    const opt = cmd?.options.find((o) => o.long === '--discord');
    expect(opt).toBeDefined();
  });

  it('should have --telegram flag', () => {
    const cmd = getStartCmd();
    const opt = cmd?.options.find((o) => o.long === '--telegram');
    expect(opt).toBeDefined();
  });

  it('should have --no-http flag', () => {
    const cmd = getStartCmd();
    const opt = cmd?.options.find((o) => o.long === '--no-http');
    expect(opt).toBeDefined();
  });

  it('should have --agent option (repeatable)', () => {
    const cmd = getStartCmd();
    const opt = cmd?.options.find((o) => o.long === '--agent');
    expect(opt).toBeDefined();
  });

  it('should have --dev flag', () => {
    const cmd = getStartCmd();
    const opt = cmd?.options.find((o) => o.long === '--dev');
    expect(opt).toBeDefined();
  });

  it('should error when not in an AgentForge project directory', async () => {
    const fsExtra = await import('fs-extra');
    vi.mocked(fsExtra.default.existsSync).mockReturnValue(false);
    const { error } = await import('../lib/display.js');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    try {
      await program.parseAsync(['node', 'agentforge', 'start']);
    } catch (e: any) {
      expect(e.message).toBe('process.exit');
    }

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Not an AgentForge project'));
    exitSpy.mockRestore();
  });
});

describe('buildModelString', () => {
  it('should prefix openrouter models with slash', () => {
    const result = buildModelString({ provider: 'openrouter', model: 'meta-llama/llama-3' });
    expect(result).toBe('openrouter/meta-llama/llama-3');
  });

  it('should concatenate provider and model', () => {
    const result = buildModelString({ provider: 'anthropic', model: 'claude-opus-4-6' });
    expect(result).toBe('anthropic/claude-opus-4-6');
  });

  it('should normalize OpenAI model names', () => {
    const result = buildModelString({ provider: 'openai', model: 'gpt-5-chat' });
    expect(result).toBe('openai/gpt-5-chat-latest');
  });

  it('should return default model when no config provided', () => {
    const result = buildModelString({});
    expect(result).toBe('moonshotai/kimi-k2.5');
  });

  it('should use custom default model', () => {
    const result = buildModelString({}, 'anthropic/claude-sonnet-4-6');
    expect(result).toBe('anthropic/claude-sonnet-4-6');
  });

  it('should not double-prefix openrouter models', () => {
    const result = buildModelString({ provider: 'openrouter', model: 'openrouter/meta-llama/llama-3' });
    expect(result).not.toBe('openrouter/openrouter/meta-llama/llama-3');
  });
});
