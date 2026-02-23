import { createTool, type Tool } from '@mastra/core/tools';
import { z } from 'zod';
import type { SkillDefinition, SkillToolDefinition } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any, any, any, any, any, any>;

/**
 * Convert a JSON Schema-like object to a Zod schema.
 * Handles basic types: string, number, boolean, object, array.
 */
export function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const type = schema['type'] as string | undefined;

  switch (type) {
    case 'string':
      return z.string();

    case 'number':
      return z.number();

    case 'boolean':
      return z.boolean();

    case 'object': {
      const properties = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
      const required = schema['required'] as string[] | undefined;

      if (!properties) {
        return z.object({});
      }

      const shape: z.ZodRawShape = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        const zodField = jsonSchemaToZod(propSchema);
        const isRequired = required?.includes(key) ?? false;
        shape[key] = isRequired ? zodField : zodField.optional();
      }

      return z.object(shape);
    }

    case 'array': {
      const items = schema['items'] as Record<string, unknown> | undefined;
      const itemSchema = items ? jsonSchemaToZod(items) : z.unknown();
      return z.array(itemSchema);
    }

    default:
      return z.unknown();
  }
}

/**
 * Convert a single SkillToolDefinition into a Mastra tool.
 * The tool's execute function is a no-op placeholder — the actual implementation
 * comes from the skill's scripts or agent instructions.
 */
export function skillToolToMastraTool(
  skillName: string,
  toolDef: SkillToolDefinition,
): AnyTool {
  const toolId = `${skillName}__${toolDef.name}`;
  const inputSchema = toolDef.inputSchema ? jsonSchemaToZod(toolDef.inputSchema) : z.object({});

  return createTool({
    id: toolId,
    description: toolDef.description ?? `Tool ${toolDef.name} from skill ${skillName}`,
    inputSchema,
    execute: async () => ({
      status: 'skill-tool-placeholder',
      skillName,
      toolName: toolDef.name,
      message: `Tool ${toolDef.name} is provided by skill ${skillName}. Execution is handled by skill instructions.`,
    }),
  }) as AnyTool;
}

/**
 * Load all tools from a SkillDefinition and return them as a record
 * suitable for passing to a Mastra Agent constructor.
 */
export function loadSkillTools(skill: SkillDefinition): Record<string, AnyTool> {
  const tools: Record<string, AnyTool> = {};

  for (const toolDef of skill.tools) {
    const toolId = `${skill.name}__${toolDef.name}`;
    tools[toolId] = skillToolToMastraTool(skill.name, toolDef);
  }

  return tools;
}
