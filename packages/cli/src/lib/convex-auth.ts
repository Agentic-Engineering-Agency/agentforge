import fs from 'fs-extra';
import path from 'node:path';

const CONVEX_API_BASE = 'https://api.convex.dev/api';

export interface ResolvedConvexAdminAuth {
  adminKey: string;
  deploymentName: string;
  deploymentType: string | null;
  url: string;
}

interface ProjectConvexConfig {
  deploymentName: string | null;
  deploymentType: string | null;
  convexUrl: string | null;
}

function readEnvVarFromFile(filePath: string, key: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const pattern = new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm');
  const match = content.match(pattern);
  if (!match) return null;
  return match[1].split('#')[0].trim().replace(/^['"]|['"]$/g, '');
}

function loadProjectConvexConfig(projectDir: string): ProjectConvexConfig {
  const envFiles = ['.env.local', '.env', '.env.production'];
  let convexDeployment: string | null = null;
  let convexUrl: string | null = null;

  for (const envFile of envFiles) {
    const envPath = path.join(projectDir, envFile);
    convexDeployment ??= readEnvVarFromFile(envPath, 'CONVEX_DEPLOYMENT');
    convexUrl ??= readEnvVarFromFile(envPath, 'CONVEX_URL');
  }

  let deploymentName: string | null = null;
  let deploymentType: string | null = null;

  if (convexDeployment) {
    const normalized = convexDeployment.trim();
    const separator = normalized.indexOf(':');
    if (separator >= 0) {
      deploymentType = normalized.slice(0, separator);
      deploymentName = normalized.slice(separator + 1);
    } else {
      deploymentName = normalized;
    }
  }

  if (!deploymentName && convexUrl) {
    try {
      const url = new URL(convexUrl);
      deploymentName = url.hostname.split('.')[0] || null;
    } catch {
      deploymentName = null;
    }
  }

  return { deploymentName, deploymentType, convexUrl };
}

function readConvexAccessToken(homeDir = process.env.HOME ?? ''): string | null {
  if (!homeDir) return null;
  const configPath = path.join(homeDir, '.convex', 'config.json');
  if (!fs.existsSync(configPath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(input: string, init: RequestInit, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(input, init);
  if (!response.ok) {
    throw new Error(`Convex auth request failed: ${response.status} ${response.statusText}`);
  }
  return await response.json() as T;
}

export async function resolveConvexAdminAuthFromLogin(options: {
  projectDir: string;
  fetchImpl?: typeof fetch;
  homeDir?: string;
}): Promise<ResolvedConvexAdminAuth | null> {
  const { projectDir, fetchImpl = fetch, homeDir } = options;
  const { deploymentName, deploymentType } = loadProjectConvexConfig(projectDir);
  if (!deploymentName) {
    return null;
  }

  const accessToken = readConvexAccessToken(homeDir);
  if (!accessToken) {
    return null;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  if (deploymentType === 'prod') {
    const authorized = await fetchJson<{
      adminKey: string;
      deploymentName: string;
      url: string;
    }>(
      `${CONVEX_API_BASE}/deployment/authorize_prod`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ deploymentName }),
      },
      fetchImpl,
    );

    return {
      adminKey: authorized.adminKey,
      deploymentName: authorized.deploymentName,
      deploymentType: 'prod',
      url: authorized.url,
    };
  }

  const teamAndProject = await fetchJson<{
    team: string;
    project: string;
  }>(
    `${CONVEX_API_BASE}/deployment/${deploymentName}/team_and_project`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    fetchImpl,
  );

  const authorized = await fetchJson<{
    adminKey: string;
    deploymentName: string;
    url: string;
  }>(
    `${CONVEX_API_BASE}/deployment/provision_and_authorize`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        teamSlug: teamAndProject.team,
        projectSlug: teamAndProject.project,
        deploymentType: 'dev',
      }),
    },
    fetchImpl,
  );

  return {
    adminKey: authorized.adminKey,
    deploymentName: authorized.deploymentName,
    deploymentType: deploymentType ?? 'dev',
    url: authorized.url,
  };
}
