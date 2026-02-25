/**
 * @module container-pool
 *
 * ContainerPool — maintains a pool of warm {@link DockerSandbox} instances
 * to amortise container cold-start latency.
 *
 * Design:
 * - A fixed-size pool of pre-started containers (warm slots).
 * - {@link ContainerPool.acquire} returns the least-recently-used idle
 *   container or starts a new one if the pool has not yet reached capacity.
 * - {@link ContainerPool.release} marks a container as idle so it can be reused.
 * - An idle-eviction sweep runs periodically and destroys containers that have
 *   been idle longer than `idleTimeoutSeconds`.
 * - LRU eviction is applied when the pool is at capacity and a new container is
 *   requested but none are idle.
 */

import type Dockerode from 'dockerode';
import { DockerSandbox } from './docker-sandbox.js';
import type { DockerSandboxConfig, PoolConfig, PoolEntry, SandboxProvider } from './types.js';
import { randomUUID } from 'node:crypto';

const DEFAULT_MAX_SIZE = 3;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 300;
const SWEEP_INTERVAL_MS = 30_000;

/**
 * A pool of warm Docker containers that can be acquired and released for reuse.
 *
 * @example
 * ```ts
 * const pool = new ContainerPool({ image: 'node:22-slim', scope: 'agent' });
 * await pool.warmUp();
 *
 * const sb = await pool.acquire();
 * await sb.exec('node -e "console.log(1+1)"');
 * await pool.release(sb);
 *
 * await pool.drain();
 * ```
 */
export class ContainerPool {
  private readonly config: Required<PoolConfig>;
  private readonly docker?: Dockerode;
  private readonly entries: Map<string, PoolEntry> = new Map();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private draining = false;

  constructor(config: PoolConfig, docker?: Dockerode) {
    this.config = {
      maxSize: DEFAULT_MAX_SIZE,
      idleTimeoutSeconds: DEFAULT_IDLE_TIMEOUT_SECONDS,
      ...config,
    };
    this.docker = docker;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Pre-warm the pool up to `maxSize` containers.
   * Resolves once all warm containers are started.
   */
  async warmUp(): Promise<void> {
    const needed = this.config.maxSize - this.entries.size;
    if (needed <= 0) return;

    await Promise.all(
      Array.from({ length: needed }).map(async () => {
        await this._addEntry();
      }),
    );

    this._startSweep();
  }

  /**
   * Acquire an idle sandbox from the pool.
   *
   * If an idle entry is available, it is marked in-use and returned immediately.
   * If the pool is not yet at capacity, a new container is started and returned.
   * If the pool is at capacity and all containers are in use, the LRU idle
   * container is evicted and a fresh one is started.
   *
   * @throws If the pool is draining.
   */
  async acquire(): Promise<SandboxProvider> {
    if (this.draining) {
      throw new Error('ContainerPool: pool is draining — cannot acquire new sandboxes.');
    }

    // 1. Find an idle entry (LRU = smallest lastUsedAt)
    const idle = this._lruIdle();
    if (idle) {
      idle.inUse = true;
      idle.lastUsedAt = Date.now();
      return idle.sandbox;
    }

    // 2. Pool has spare capacity — start a fresh container
    if (this.entries.size < this.config.maxSize) {
      const entry = await this._addEntry();
      entry.inUse = true;
      entry.lastUsedAt = Date.now();
      return entry.sandbox;
    }

    // 3. Pool at capacity, all in use — evict LRU entry and replace
    const lruKey = this._lruAnyKey();
    if (lruKey) {
      const evicted = this.entries.get(lruKey)!;
      this.entries.delete(lruKey);
      void evicted.sandbox.destroy().catch(() => {/* best-effort */});
    }

    const entry = await this._addEntry();
    entry.inUse = true;
    entry.lastUsedAt = Date.now();
    return entry.sandbox;
  }

  /**
   * Release a previously acquired sandbox back to the pool.
   * The sandbox is reset to an idle state for future reuse.
   */
  async release(sandbox: SandboxProvider): Promise<void> {
    for (const entry of this.entries.values()) {
      if (entry.sandbox === sandbox) {
        entry.inUse = false;
        entry.lastUsedAt = Date.now();
        return;
      }
    }
    // Sandbox not found in pool — destroy it to avoid leaks
    await sandbox.destroy();
  }

  /**
   * Drain the pool: stop acquiring and destroy all containers.
   * After draining, the pool stays in a drained state and rejects new acquires.
   */
  async drain(): Promise<void> {
    if (this.draining && this.entries.size === 0) return;
    this.draining = true;
    this._stopSweep();

    await Promise.all(
      Array.from(this.entries.values()).map((entry) =>
        entry.sandbox.destroy().catch(() => {/* best-effort */}),
      ),
    );
    this.entries.clear();
  }

  /**
   * Returns the current number of entries (in-use + idle).
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Returns the number of idle (available) entries.
   */
  get idleCount(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (!entry.inUse) count++;
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _addEntry(): Promise<PoolEntry> {
    const sandboxConfig: DockerSandboxConfig = {
      image: this.config.image,
      scope: this.config.scope,
      workspaceAccess: 'none',
    };

    const sandbox = new DockerSandbox(sandboxConfig, this.docker);
    await sandbox.start();

    const id = randomUUID();
    const entry: PoolEntry = {
      sandbox,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      inUse: false,
    };

    this.entries.set(id, entry);
    return entry;
  }

  /** Return the idle entry with the smallest lastUsedAt (LRU idle). */
  private _lruIdle(): PoolEntry | null {
    let best: PoolEntry | null = null;
    for (const entry of this.entries.values()) {
      if (!entry.inUse) {
        if (!best || entry.lastUsedAt < best.lastUsedAt) {
          best = entry;
        }
      }
    }
    return best;
  }

  /** Return the key of the entry with the smallest lastUsedAt (LRU any). */
  private _lruAnyKey(): string | null {
    let bestKey: string | null = null;
    let bestTime = Infinity;
    for (const [key, entry] of this.entries) {
      if (entry.lastUsedAt < bestTime) {
        bestTime = entry.lastUsedAt;
        bestKey = key;
      }
    }
    return bestKey;
  }

  /** Start periodic idle-eviction sweep. */
  private _startSweep(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => void this._sweep(), SWEEP_INTERVAL_MS);
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  private _stopSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /** Remove and destroy containers that have been idle past the timeout. */
  private async _sweep(): Promise<void> {
    if (this.draining) return;

    const nowMs = Date.now();
    const idleTimeoutMs = this.config.idleTimeoutSeconds * 1000;

    const evictions: [string, PoolEntry][] = [];

    for (const [key, entry] of this.entries) {
      if (!entry.inUse && nowMs - entry.lastUsedAt > idleTimeoutMs) {
        evictions.push([key, entry]);
      }
    }

    for (const [key, entry] of evictions) {
      this.entries.delete(key);
      await entry.sandbox.destroy().catch(() => {/* best-effort */});
    }
  }
}
