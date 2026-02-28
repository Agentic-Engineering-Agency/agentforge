import { z } from 'zod';

/**
 * Bundled skill types for AgentForge
 *
 * Simple, composable skills that can be executed by agents.
 */
export interface BundledSkill {
  name: string;
  description: string;
  category: 'web' | 'computation' | 'datetime' | 'io' | 'system';
  execute: (args: Record<string, unknown>) => Promise<string>;
  schema?: {
    input?: Record<string, { type: string; description: string; required?: boolean }>;
    output?: string;
  };
}

export const skillDefinitionSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9-]*$/, 'Skill name must be kebab-case'),
  description: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g., 1.0.0)'),
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        inputSchema: z.record(z.unknown()).optional(),
      }),
    )
    .optional()
    .default([]),
  config: z.record(z.unknown()).optional().default({}),
  metadata: z
    .object({
      author: z.string().optional(),
      license: z.string().optional(),
      repository: z.string().optional(),
      tags: z.array(z.string()).optional().default([]),
    })
    .optional()
    .default({}),
});

export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;

export interface SkillToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class SkillParseError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'SkillParseError';
  }
}
