import { Agent, type ToolsInput } from '@mastra/core/agent';
import { UnicodeNormalizer, TokenLimiterProcessor } from '@mastra/core/processors';
import type { Workspace } from '@mastra/core/workspace';
import { DAEMON_MODEL, DEFAULT_TOKEN_LIMIT, createStandardMemory } from './shared.js';

export interface StandardAgentConfig {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model?: string;
  tools?: ToolsInput;
  workspace?: Workspace;
  workingMemoryTemplate?: string;
  disableMemory?: boolean;
  disableObservationalMemory?: boolean;
}

export function createStandardAgent(config: StandardAgentConfig): Agent {
  const model = config.model ?? DAEMON_MODEL;
  const memory = config.disableMemory ? undefined : createStandardMemory({
    workingMemoryTemplate: config.workingMemoryTemplate,
    observationalMemory: config.disableObservationalMemory ? false : undefined,
  });

  const inputProcessors = [
    new UnicodeNormalizer({ stripControlChars: true, collapseWhitespace: true }),
    new TokenLimiterProcessor({ limit: DEFAULT_TOKEN_LIMIT, strategy: 'truncate', countMode: 'cumulative' }),
  ];

  return new Agent({
    id: config.id,
    name: config.name,
    description: config.description,
    model,
    memory,
    tools: config.tools ?? {},
    workspace: config.workspace,
    inputProcessors,
    instructions: config.instructions,
  });
}
