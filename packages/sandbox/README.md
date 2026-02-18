# @agentforge-ai/sandbox

Docker-based sandbox provider for AgentForge agent tool execution isolation.

## Overview

This package implements container-based isolation for agent tool execution using Docker. It provides:

- **`DockerSandbox`** — a container-backed `SandboxProvider` that manages the full lifecycle of a Docker container
- **`ContainerPool`** — a warm-container pool to amortise Docker cold-start latency (LRU eviction, idle timeout)
- **`SandboxManager`** — factory that creates the right sandbox type (Docker vs E2B) based on config, with graceful shutdown on process exit

## Installation

```bash
pnpm add @agentforge-ai/sandbox dockerode
```

## Quick Start

```typescript
import { SandboxManager } from '@agentforge-ai/sandbox';

const manager = new SandboxManager({ provider: 'docker' });
await manager.initialize();

const sb = await manager.create({ scope: 'agent', workspaceAccess: 'none' });

const { stdout, exitCode } = await sb.exec('node --version');
console.log(stdout); // v22.x.x

await sb.writeFile('/tmp/hello.js', 'console.log("hello from container")');
const result = await sb.exec('node /tmp/hello.js');
console.log(result.stdout); // hello from container

await manager.destroy(sb);
await manager.shutdown();
```

## Configuration

### `DockerSandboxConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `scope` | `'session' \| 'agent' \| 'shared'` | required | Lifecycle scope |
| `workspaceAccess` | `'none' \| 'ro' \| 'rw'` | required | Host workspace mount mode |
| `image` | `string` | `'node:22-slim'` | Docker image |
| `workspacePath` | `string` | — | Host workspace directory |
| `containerWorkspacePath` | `string` | `'/workspace'` | Mount point inside container |
| `resourceLimits.cpuShares` | `number` | Docker default | CPU weight |
| `resourceLimits.memoryMb` | `number` | unlimited | Memory cap in MB |
| `resourceLimits.pidsLimit` | `number` | `256` | Max PIDs in container |
| `resourceLimits.networkDisabled` | `boolean` | `false` | Disable networking |
| `binds` | `string[]` | `[]` | Extra bind mounts (`host:container:mode`) |
| `env` | `Record<string, string>` | `{}` | Environment variables |
| `timeout` | `number` | none | Auto-kill after N seconds |

### `PoolConfig`

```typescript
const pool = new ContainerPool({
  image: 'node:22-slim',
  scope: 'agent',
  maxSize: 3,             // warm containers to keep ready (default: 3)
  idleTimeoutSeconds: 300 // evict after 5 min idle (default: 300)
});

await pool.warmUp();
const sb = await pool.acquire();
// ... use sandbox ...
await pool.release(sb);
await pool.drain(); // cleanup
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DOCKER_HOST` | Docker daemon host (default: Unix socket) |
| `DOCKER_IMAGE` | Default image for agent sandboxes |
| `AGENTFORGE_ALLOWED_IMAGES` | Comma-separated image prefixes allowed in production |

## Security

- **Blocked bind mounts**: `/var/run/docker.sock`, `/etc`, `/proc`, `/sys`, `/dev`, `/boot`, `/root`
- **Capabilities**: All Linux capabilities dropped by default (`CapDrop: ALL`)
- **No new privileges**: `SecurityOpt: no-new-privileges:true` applied to every container
- **PID limit**: Default 256 PIDs per container to prevent fork bombs
- **Image validation**: In production (`NODE_ENV=production`), only images with approved prefixes are allowed
- **Command validation**: Defense-in-depth checks block docker.sock access and nsenter attempts

## Docker Connection

Connects to the Docker daemon via:
- Unix socket (default): `/var/run/docker.sock`
- TCP: configure via `SandboxManager({ dockerHost: { host, port, protocol } })`
- Env: `DOCKER_HOST` environment variable

## Requirements

- Node.js ≥ 18
- Docker Engine installed and running on the host
- `dockerode` peer dependency

## License

Apache-2.0
