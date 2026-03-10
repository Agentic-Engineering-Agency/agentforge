import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { resolveConvexAdminAuthFromLogin } from './convex-auth.js';

describe('convex-auth', () => {
  let tmpDir: string;
  let homeDir: string;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    tmpDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-convex-auth-')));
    homeDir = path.join(tmpDir, 'home');
    await fs.ensureDir(path.join(homeDir, '.convex'));
    await fs.writeJson(path.join(homeDir, '.convex', 'config.json'), {
      accessToken: 'test-access-token',
    });
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    await fs.remove(tmpDir);
  });

  it('returns null when no deployment is configured', async () => {
    await fs.writeFile(path.join(tmpDir, '.env.local'), 'OPENAI_API_KEY=\n');

    const result = await resolveConvexAdminAuthFromLogin({
      projectDir: tmpDir,
      homeDir,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    expect(result).toBeNull();
  });

  it('authorizes the configured dev deployment from the local Convex login', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.env.local'),
      'CONVEX_DEPLOYMENT=dev:outstanding-dachshund-365\nCONVEX_URL=https://outstanding-dachshund-365.convex.cloud\n',
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/deployment/outstanding-dachshund-365/team_and_project')) {
        expect(init?.headers).toEqual({ Authorization: 'Bearer test-access-token' });
        return new Response(JSON.stringify({
          team: 'agenticengineering',
          project: 'agentforge-test-codex-refactor',
        }), { status: 200 });
      }

      expect(url).toBe('https://api.convex.dev/api/deployment/provision_and_authorize');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({
        Authorization: 'Bearer test-access-token',
        'Content-Type': 'application/json',
      });
      expect(init?.body).toBe(JSON.stringify({
        teamSlug: 'agenticengineering',
        projectSlug: 'agentforge-test-codex-refactor',
        deploymentType: 'dev',
      }));

      return new Response(JSON.stringify({
        adminKey: 'resolved-admin-key',
        deploymentName: 'outstanding-dachshund-365',
        url: 'https://outstanding-dachshund-365.convex.cloud',
      }), { status: 200 });
    });

    const result = await resolveConvexAdminAuthFromLogin({
      projectDir: tmpDir,
      homeDir,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      adminKey: 'resolved-admin-key',
      deploymentName: 'outstanding-dachshund-365',
      deploymentType: 'dev',
      url: 'https://outstanding-dachshund-365.convex.cloud',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to os.homedir when homeDir is omitted', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.env.local'),
      'CONVEX_DEPLOYMENT=dev:outstanding-dachshund-365\n',
    );

    const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/deployment/outstanding-dachshund-365/team_and_project')) {
        return new Response(JSON.stringify({
          team: 'agenticengineering',
          project: 'agentforge-test-codex-refactor',
        }), { status: 200 });
      }

      return new Response(JSON.stringify({
        adminKey: 'resolved-admin-key',
        deploymentName: 'outstanding-dachshund-365',
        url: 'https://outstanding-dachshund-365.convex.cloud',
      }), { status: 200 });
    });

    const result = await resolveConvexAdminAuthFromLogin({
      projectDir: tmpDir,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(homedirSpy).toHaveBeenCalled();
    expect(result?.adminKey).toBe('resolved-admin-key');
  });
});
