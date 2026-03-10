import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTool, type Tool } from '@mastra/core/tools';
import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any, any, any, any, any, any>;

interface RuntimeSkillToolDefinition {
  name: string;
  description?: string;
  inputSchema?: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown> | unknown;
}

interface RuntimeSkillModule {
  tools?: RuntimeSkillToolDefinition[];
  default?: {
    tools?: RuntimeSkillToolDefinition[];
  };
}

const SKILL_ENTRY_CANDIDATES = ['index.ts', 'index.mts', 'index.js', 'index.mjs'] as const;
const INTERNAL_SPECIFIER_REWRITES: Record<string, string> = {
  '@agentforge-ai/core': import.meta.url,
  '@agentforge-ai/core/browser': new URL('./browser-tool.js', import.meta.url).href,
};

function isZodSchema(value: unknown): value is z.ZodTypeAny {
  return typeof value === 'object' && value !== null && 'safeParse' in value;
}

async function importSkillModule(modulePath: string): Promise<RuntimeSkillModule> {
  if (modulePath.endsWith('.ts') || modulePath.endsWith('.mts') || modulePath.endsWith('.tsx')) {
    const source = await fs.readFile(modulePath, 'utf-8');
    const ts = await import('typescript');
    let transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: modulePath,
    }).outputText;

    for (const [specifier, replacement] of Object.entries(INTERNAL_SPECIFIER_REWRITES)) {
      const quotedSpecifier = JSON.stringify(specifier);
      transpiled = transpiled.split(quotedSpecifier).join(JSON.stringify(replacement));
      transpiled = transpiled.split(`'${specifier}'`).join(JSON.stringify(replacement));
    }

    const tempModulePath = path.join(
      path.dirname(modulePath),
      `.agentforge-skill-${path.basename(modulePath, path.extname(modulePath))}-${Date.now()}.mjs`,
    );
    await fs.writeFile(tempModulePath, transpiled, 'utf-8');

    try {
      return await import(`${pathToFileURL(tempModulePath).href}?t=${Date.now()}`) as RuntimeSkillModule;
    } finally {
      await fs.unlink(tempModulePath).catch(() => undefined);
    }
  }

  return await import(pathToFileURL(modulePath).href) as RuntimeSkillModule;
}

function toMastraTool(skillName: string, toolDef: RuntimeSkillToolDefinition, toolId: string): AnyTool {
  const inputSchema = isZodSchema(toolDef.inputSchema) ? toolDef.inputSchema : z.object({}).passthrough();
  const outputSchema = isZodSchema(toolDef.outputSchema) ? toolDef.outputSchema : undefined;

  return createTool({
    id: toolId,
    description: toolDef.description ?? `Tool ${toolDef.name} from skill ${skillName}`,
    inputSchema,
    ...(outputSchema ? { outputSchema } : {}),
    execute: async (input) => await toolDef.handler(input),
  }) as AnyTool;
}

async function resolveSkillEntry(skillDir: string): Promise<string | null> {
  for (const candidate of SKILL_ENTRY_CANDIDATES) {
    const fullPath = path.join(skillDir, candidate);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        return fullPath;
      }
    } catch {
      // Ignore missing candidates.
    }
  }

  return null;
}

export async function loadExecutableSkillTools(skillsBasePath: string): Promise<Record<string, AnyTool>> {
  const tools: Record<string, AnyTool> = {};

  let entries: string[] = [];
  try {
    entries = (await fs.readdir(skillsBasePath)).sort((a, b) => a.localeCompare(b));
  } catch {
    return tools;
  }

  for (const entry of entries) {
    if (entry.startsWith('.')) {
      continue;
    }

    const skillDir = path.join(skillsBasePath, entry);
    let stat;
    try {
      stat = await fs.stat(skillDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }

    const entryFile = await resolveSkillEntry(skillDir);
    if (!entryFile) {
      continue;
    }

    const skillModule = await importSkillModule(entryFile);
    const toolDefs = skillModule.tools ?? skillModule.default?.tools ?? [];

    for (const toolDef of toolDefs) {
      if (!toolDef?.name || typeof toolDef.handler !== 'function') {
        continue;
      }

      const toolName = toolDef.name;
      const toolId = tools[toolName] ? `${entry}__${toolName}` : toolName;
      tools[toolId] = toMastraTool(entry, toolDef, toolId);
    }
  }

  return tools;
}
