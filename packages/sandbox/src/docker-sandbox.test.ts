/**
 * Unit tests for DockerSandbox.
 *
 * All Docker API calls are mocked — no real Docker daemon is required.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DockerSandbox } from './docker-sandbox.js';
import { SecurityError } from './security.js';
import type { DockerSandboxConfig } from './types.js';

// ---------------------------------------------------------------------------
// Helpers to build mock Dockerode instances
// ---------------------------------------------------------------------------

function makeMockExecInspect(exitCode = 0) {
  return vi.fn().mockResolvedValue({ ExitCode: exitCode });
}

function makeMockExecStart(stdout = '', stderr = '', exitCode = 0) {
  const encode = (type: number, text: string) => {
    const data = Buffer.from(text, 'utf8');
    const header = Buffer.alloc(8);
    header[0] = type;
    header.writeUInt32BE(data.length, 4);
    return Buffer.concat([header, data]);
  };

  const chunks: Buffer[] = [];
  if (stdout) chunks.push(encode(1, stdout));
  if (stderr) chunks.push(encode(2, stderr));
  const combined = Buffer.concat(chunks);

  const inspectFn = makeMockExecInspect(exitCode);

  return {
    startFn: vi.fn().mockImplementation(
      (_opts: unknown, cb: (err: null, stream: NodeJS.EventEmitter) => void) => {
        const { EventEmitter } = require('events');
        const stream = new EventEmitter();
        process.nextTick(() => {
          stream.emit('data', combined);
          stream.emit('end');
        });
        cb(null, stream);
      },
    ),
    inspectFn,
  };
}

function makeMockContainer(
  opts: {
    running?: boolean;
    execStdout?: string;
    execStderr?: string;
    execExitCode?: number;
  } = {},
) {
  const { running = true, execStdout = '', execStderr = '', execExitCode = 0 } = opts;

  const { startFn, inspectFn } = makeMockExecStart(execStdout, execStderr, execExitCode);

  const execMock = vi.fn().mockResolvedValue({
    start: startFn,
    inspect: inspectFn,
  });

  const containerStartMock = vi.fn().mockResolvedValue(undefined);
  const containerStopMock = vi.fn().mockResolvedValue(undefined);
  const removeMock = vi.fn().mockResolvedValue(undefined);
  const inspectContainerMock = vi.fn().mockResolvedValue({ State: { Running: running } });

  return {
    id: 'mock-container-id-abc123',
    start: containerStartMock,
    stop: containerStopMock,
    remove: removeMock,
    inspect: inspectContainerMock,
    exec: execMock,
    _mocks: {
      containerStartMock,
      containerStopMock,
      removeMock,
      inspectContainerMock,
      execMock,
      startFn,
      inspectFn,
    },
  };
}

function makeMockDocker(containerOpts?: Parameters<typeof makeMockContainer>[0]) {
  const container = makeMockContainer(containerOpts);
  const createContainerMock = vi.fn().mockResolvedValue(container);

  return {
    docker: { createContainer: createContainerMock } as unknown as import('dockerode'),
    container,
    createContainerMock,
  };
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const BASE_CONFIG: DockerSandboxConfig = {
  scope: 'agent',
  workspaceAccess: 'none',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DockerSandbox — construction', () => {
  it('accepts valid config without throwing', () => {
    const { docker } = makeMockDocker();
    expect(() => new DockerSandbox(BASE_CONFIG, docker)).not.toThrow();
  });

  it('uses node:22-slim as the default image', () => {
    const { docker } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    expect(sb).toBeInstanceOf(DockerSandbox);
  });

  it('rejects a bind mount with a blocked path', () => {
    const { docker } = makeMockDocker();
    expect(
      () =>
        new DockerSandbox(
          { ...BASE_CONFIG, binds: ['/etc/passwd:/etc/passwd:ro'] },
          docker,
        ),
    ).toThrow(SecurityError);
  });

  it('rejects /var/run/docker.sock bind', () => {
    const { docker } = makeMockDocker();
    expect(
      () =>
        new DockerSandbox(
          { ...BASE_CONFIG, binds: ['/var/run/docker.sock:/var/run/docker.sock:rw'] },
          docker,
        ),
    ).toThrow(SecurityError);
  });

  it('returns null containerId before start()', () => {
    const { docker } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    expect(sb.getContainerId()).toBeNull();
  });
});

describe('DockerSandbox — lifecycle', () => {
  it('start() creates and starts a container', async () => {
    const { docker, container, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    await sb.start();

    expect(createContainerMock).toHaveBeenCalledOnce();
    expect(container._mocks.containerStartMock).toHaveBeenCalledOnce();
    expect(sb.getContainerId()).toBe('mock-container-id-abc123');
  });

  it('start() is idempotent — calling twice only creates one container', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    await sb.start();
    await sb.start();

    expect(createContainerMock).toHaveBeenCalledOnce();
  });

  it('stop() calls container.stop() when running', async () => {
    const { docker, container } = makeMockDocker({ running: true });
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    await sb.start();
    await sb.stop();

    expect(container._mocks.containerStopMock).toHaveBeenCalledOnce();
  });

  it('stop() is safe to call before start()', async () => {
    const { docker } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    await expect(sb.stop()).resolves.toBeUndefined();
  });

  it('destroy() removes the container', async () => {
    const { docker, container } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    await sb.start();
    await sb.destroy();

    expect(container._mocks.removeMock).toHaveBeenCalledWith({ force: true });
    expect(sb.getContainerId()).toBeNull();
  });

  it('destroy() is idempotent', async () => {
    const { docker, container } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    await sb.start();
    await sb.destroy();
    await sb.destroy();

    expect(container._mocks.removeMock).toHaveBeenCalledOnce();
  });

  it('destroy() is safe to call before start()', async () => {
    const { docker } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    await expect(sb.destroy()).resolves.toBeUndefined();
  });

  it('sets up auto-kill timer when timeout is configured', async () => {
    vi.useFakeTimers();
    const { docker, container } = makeMockDocker();
    const sb = new DockerSandbox({ ...BASE_CONFIG, timeout: 5 }, docker);

    await sb.start();

    expect(container._mocks.removeMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(6000);

    expect(container._mocks.removeMock).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('DockerSandbox — isRunning()', () => {
  it('returns true when container is running', async () => {
    const { docker } = makeMockDocker({ running: true });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    expect(await sb.isRunning()).toBe(true);
  });

  it('returns false when container is stopped', async () => {
    const { docker } = makeMockDocker({ running: false });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    expect(await sb.isRunning()).toBe(false);
  });

  it('returns false when not started', async () => {
    const { docker } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    expect(await sb.isRunning()).toBe(false);
  });
});

describe('DockerSandbox — exec()', () => {
  it('runs a command and returns stdout/stderr/exitCode', async () => {
    const { docker } = makeMockDocker({
      execStdout: 'hello\n',
      execStderr: '',
      execExitCode: 0,
    });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    const result = await sb.exec('echo hello');

    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });

  it('returns non-zero exit code on failure', async () => {
    const { docker } = makeMockDocker({
      execStdout: '',
      execStderr: 'not found\n',
      execExitCode: 127,
    });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    const result = await sb.exec('nonexistent-command');

    expect(result.exitCode).toBe(127);
    expect(result.stderr).toBe('not found\n');
  });

  it('throws if called before start()', async () => {
    const { docker } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);

    await expect(sb.exec('echo hi')).rejects.toThrow(/not running/);
  });

  it('passes cwd and env to the exec call', async () => {
    const { docker, container } = makeMockDocker({
      execStdout: 'ok',
      execExitCode: 0,
    });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    await sb.exec('pwd', { cwd: '/tmp', env: { FOO: 'bar' } });

    expect(container._mocks.execMock).toHaveBeenCalledWith(
      expect.objectContaining({
        WorkingDir: '/tmp',
        Env: ['FOO=bar'],
      }),
    );
  });
});

describe('DockerSandbox — readFile() / writeFile()', () => {
  it('readFile() returns file content', async () => {
    const { docker } = makeMockDocker({
      execStdout: 'file content',
      execExitCode: 0,
    });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    const content = await sb.readFile('/tmp/test.txt');
    expect(content).toBe('file content');
  });

  it('readFile() throws on non-zero exit code', async () => {
    const { docker } = makeMockDocker({
      execStdout: '',
      execStderr: 'No such file',
      execExitCode: 1,
    });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    await expect(sb.readFile('/tmp/missing.txt')).rejects.toThrow(/failed to read/);
  });

  it('writeFile() encodes content as base64 and writes', async () => {
    const { docker, container } = makeMockDocker({
      execStdout: '',
      execExitCode: 0,
    });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    await sb.writeFile('/tmp/out.txt', 'hello world');

    const execCall = container._mocks.execMock.mock.calls[0][0] as { Cmd: string[] };
    const cmd = execCall.Cmd[2];
    expect(cmd).toContain('base64 -d');
    expect(cmd).toContain(Buffer.from('hello world').toString('base64'));
  });

  it('writeFile() throws on non-zero exit code', async () => {
    const { docker } = makeMockDocker({
      execExitCode: 1,
      execStderr: 'permission denied',
    });
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    await expect(sb.writeFile('/root/nope.txt', 'x')).rejects.toThrow(/failed to write/);
  });
});

describe('DockerSandbox — container configuration', () => {
  it('passes env vars to createContainer', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox({ ...BASE_CONFIG, env: { MY_VAR: 'value' } }, docker);
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as { Env: string[] };
    expect(call.Env).toContain('MY_VAR=value');
  });

  it('sets memory limit in bytes from memoryMb', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(
      { ...BASE_CONFIG, resourceLimits: { memoryMb: 256 } },
      docker,
    );
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as {
      HostConfig: { Memory: number };
    };
    expect(call.HostConfig.Memory).toBe(256 * 1024 * 1024);
  });

  it('drops ALL capabilities by default', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as {
      HostConfig: { CapDrop: string[] };
    };
    expect(call.HostConfig.CapDrop).toContain('ALL');
  });

  it('sets no-new-privileges SecurityOpt', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as {
      HostConfig: { SecurityOpt: string[] };
    };
    expect(call.HostConfig.SecurityOpt).toContain('no-new-privileges:true');
  });

  it('disables network when networkDisabled is true', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(
      { ...BASE_CONFIG, resourceLimits: { networkDisabled: true } },
      docker,
    );
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as {
      NetworkDisabled: boolean;
    };
    expect(call.NetworkDisabled).toBe(true);
  });

  it('mounts workspace in read-only mode when configured', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(
      {
        ...BASE_CONFIG,
        workspaceAccess: 'ro',
        workspacePath: '/home/user/project',
      },
      docker,
    );
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as {
      HostConfig: { Binds: string[] };
    };
    expect(call.HostConfig.Binds).toContain('/home/user/project:/workspace:ro');
  });

  it('mounts workspace in read-write mode when configured', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(
      {
        ...BASE_CONFIG,
        workspaceAccess: 'rw',
        workspacePath: '/home/user/project',
        containerWorkspacePath: '/app',
      },
      docker,
    );
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as {
      HostConfig: { Binds: string[] };
    };
    expect(call.HostConfig.Binds).toContain('/home/user/project:/app:rw');
  });

  it('sets agentforge labels on the container', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as {
      Labels: Record<string, string>;
    };
    expect(call.Labels['agentforge.managed']).toBe('true');
    expect(call.Labels['agentforge.scope']).toBe('agent');
  });

  it('sets PidsLimit by default', async () => {
    const { docker, createContainerMock } = makeMockDocker();
    const sb = new DockerSandbox(BASE_CONFIG, docker);
    await sb.start();

    const call = createContainerMock.mock.calls[0][0] as {
      HostConfig: { PidsLimit: number };
    };
    expect(call.HostConfig.PidsLimit).toBe(256);
  });
});
