import fs from 'fs-extra';
import path from 'node:path';

export interface AgentForgeProjectConfig {
  daemon?: {
    defaultModel?: string;
    dbUrl?: string;
    dev?: boolean;
  };
  channels?: {
    http?: {
      port?: number;
    };
    discord?: {
      enabled?: boolean;
      defaultAgentId?: string;
      autoChannels?: string[];
      teamChannel?: string;
      editIntervalMs?: number;
    };
    telegram?: {
      enabled?: boolean;
      defaultAgentId?: string;
      allowedChatIds?: number[];
      editIntervalMs?: number;
    };
  };
  workspace?: {
    basePath?: string;
    skills?: string[];
    search?: boolean;
    autoIndexPaths?: string[];
  };
  agents?: Array<{
    id: string;
    model?: string;
    provider?: string;
  }>;
}

export async function loadProjectConfig(projectDir: string): Promise<AgentForgeProjectConfig | null> {
  const tsConfigPath = path.join(projectDir, 'agentforge.config.ts');
  if (await fs.pathExists(tsConfigPath)) {
    const source = await fs.readFile(tsConfigPath, 'utf-8');
    const ts = await import('typescript');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const loaded = await import(moduleUrl);
    return (loaded.default ?? loaded) as AgentForgeProjectConfig;
  }

  const jsonConfigPath = path.join(projectDir, 'agentforge.json');
  if (await fs.pathExists(jsonConfigPath)) {
    return await fs.readJson(jsonConfigPath) as AgentForgeProjectConfig;
  }

  return null;
}

export function loadProjectEnv(projectDir: string): void {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(projectDir, envFile);
    if (!fs.existsSync(envPath)) continue;

    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex < 1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}
