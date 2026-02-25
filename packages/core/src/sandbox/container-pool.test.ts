/**
 * Unit tests for ContainerPool.
 *
 * Uses a mock DockerSandbox via vi.mock to avoid real Docker calls.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContainerPool } from './container-pool.js';
import type { SandboxProvider } from './types.js';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContainerPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with zero entries', () => {
    const pool = new ContainerPool({ image: 'node:22-slim', scope: 'agent' });
    expect(pool.size).toBe(0);
    expect(pool.idleCount).toBe(0);
  });

  it('warmUp() creates maxSize containers', async () => {
    const pool = new ContainerPool({
      image: 'node:22-slim',
      scope: 'agent',
      maxSize: 2,
    });

    await pool.warmUp();

    expect(pool.size).toBe(2);
    expect(pool.idleCount).toBe(2);
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('acquire() returns an idle sandbox', async () => {
    const pool = new ContainerPool({
      image: 'node:22-slim',
      scope: 'agent',
      maxSize: 2,
    });

    await pool.warmUp();
    const sb = await pool.acquire();

    expect(sb).toBeDefined();
    expect(pool.idleCount).toBe(1);
  });

  it('release() returns sandbox to idle state', async () => {
    const pool = new ContainerPool({
      image: 'node:22-slim',
      scope: 'agent',
      maxSize: 2,
    });

    await pool.warmUp();
    const sb = await pool.acquire();
    expect(pool.idleCount).toBe(1);

    await pool.release(sb);
    expect(pool.idleCount).toBe(2);
  });

  it('drain() destroys all containers', async () => {
    const pool = new ContainerPool({
      image: 'node:22-slim',
      scope: 'agent',
      maxSize: 2,
    });

    await pool.warmUp();
    await pool.drain();

    expect(pool.size).toBe(0);
    expect(mockDestroy).toHaveBeenCalledTimes(2);
  });

  it('acquire() throws after drain()', async () => {
    const pool = new ContainerPool({
      image: 'node:22-slim',
      scope: 'agent',
      maxSize: 1,
    });

    await pool.warmUp();
    await pool.drain();

    await expect(pool.acquire()).rejects.toThrow(/draining/);
  });

  it('release() destroys unknown sandboxes', async () => {
    const pool = new ContainerPool({
      image: 'node:22-slim',
      scope: 'agent',
      maxSize: 1,
    });

    const unknownSandbox: SandboxProvider = {
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      isRunning: vi.fn(),
      getContainerId: vi.fn(),
    };

    await pool.release(unknownSandbox);
    expect(unknownSandbox.destroy).toHaveBeenCalled();
  });
});
