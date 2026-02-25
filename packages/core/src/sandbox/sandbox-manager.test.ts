/**
 * Unit tests for SandboxManager.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SandboxManager, isDockerAvailable } from './sandbox-manager.js';

// ---------------------------------------------------------------------------
// Mock DockerSandbox
// ---------------------------------------------------------------------------

const mockStart = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn().mockResolvedValue(undefined);
const mockExec = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
const mockReadFile = vi.fn().mockResolvedValue('');
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockIsRunning = vi.fn().mockResolvedValue(true);
const mockGetContainerId = vi.fn().mockReturnValue('mock-id');

vi.mock('./docker-sandbox.js', () => ({
  DockerSandbox: vi.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
    destroy: mockDestroy,
    exec: mockExec,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    isRunning: mockIsRunning,
    getContainerId: mockGetContainerId,
  })),
}));

// Mock Dockerode
vi.mock('dockerode', () => ({
  default: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('OK'),
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SandboxManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates with default config', () => {
    const manager = new SandboxManager();
    expect(manager).toBeInstanceOf(SandboxManager);
    expect(manager.activeCount).toBe(0);
  });

  it('initialize() completes without error', async () => {
    const manager = new SandboxManager();
    await expect(manager.initialize()).resolves.toBeUndefined();
  });

  it('create() creates and starts a Docker sandbox', async () => {
    const manager = new SandboxManager();
    await manager.initialize();

    const sb = await manager.create({ scope: 'agent', workspaceAccess: 'none' });

    expect(sb).toBeDefined();
    expect(mockStart).toHaveBeenCalledOnce();
    expect(manager.activeCount).toBe(1);
  });

  it('destroy() removes sandbox from active registry', async () => {
    const manager = new SandboxManager();
    await manager.initialize();

    const sb = await manager.create({ scope: 'agent', workspaceAccess: 'none' });
    expect(manager.activeCount).toBe(1);

    await manager.destroy(sb);
    expect(manager.activeCount).toBe(0);
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('shutdown() destroys all active sandboxes', async () => {
    const manager = new SandboxManager();
    await manager.initialize();

    await manager.create({ scope: 'agent', workspaceAccess: 'none' });
    await manager.create({ scope: 'session', workspaceAccess: 'ro' });
    expect(manager.activeCount).toBe(2);

    await manager.shutdown();
    expect(manager.activeCount).toBe(0);
    expect(mockDestroy).toHaveBeenCalledTimes(2);
  });

  it('create() with e2b provider returns a stub', async () => {
    const manager = new SandboxManager({ provider: 'e2b' });
    await manager.initialize();

    const sb = await manager.create({ scope: 'agent', workspaceAccess: 'none' });
    expect(sb).toBeDefined();

    // E2B stub throws on start
    await expect(sb.start()).rejects.toThrow(/E2B provider is not bundled/);
  });

  it('create() merges dockerConfig with overrides', async () => {
    const manager = new SandboxManager({
      dockerConfig: {
        image: 'python:3.12',
        resourceLimits: { memoryMb: 512 },
      },
    });
    await manager.initialize();

    const sb = await manager.create({ scope: 'agent', workspaceAccess: 'none' });
    expect(sb).toBeDefined();
    expect(mockStart).toHaveBeenCalledOnce();
  });
});

describe('isDockerAvailable()', () => {
  it('returns true when Docker daemon responds', async () => {
    const mockDocker = { ping: vi.fn().mockResolvedValue('OK') } as unknown as import('dockerode');
    expect(await isDockerAvailable(mockDocker)).toBe(true);
  });

  it('returns false when Docker daemon is unreachable', async () => {
    const mockDocker = {
      ping: vi.fn().mockRejectedValue(new Error('ENOENT')),
    } as unknown as import('dockerode');
    expect(await isDockerAvailable(mockDocker)).toBe(false);
  });
});
