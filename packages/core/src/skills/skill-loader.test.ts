import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@mastra/core/tools', () => ({
  createTool: (config: Record<string, unknown>) => ({
    ...config,
    _type: 'mastra-tool',
  }),
}));

import { loadSkillTools, skillToolToMastraTool, jsonSchemaToZod } from './skill-loader.js';
import type { SkillDefinition, SkillToolDefinition } from './types.js';

describe('jsonSchemaToZod', () => {
  it('should convert string type', () => {
    const result = jsonSchemaToZod({ type: 'string' });
    expect(result).toBeInstanceOf(z.ZodString);
  });

  it('should convert number type', () => {
    const result = jsonSchemaToZod({ type: 'number' });
    expect(result).toBeInstanceOf(z.ZodNumber);
  });

  it('should convert boolean type', () => {
    const result = jsonSchemaToZod({ type: 'boolean' });
    expect(result).toBeInstanceOf(z.ZodBoolean);
  });

  it('should convert object type with properties', () => {
    const schema: Record<string, unknown> = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };
    const result = jsonSchemaToZod(schema);
    expect(result).toBeInstanceOf(z.ZodObject);

    // name is required, age is optional
    const parsed = (result as z.ZodObject<z.ZodRawShape>).safeParse({ name: 'Alice' });
    expect(parsed.success).toBe(true);

    const withAge = (result as z.ZodObject<z.ZodRawShape>).safeParse({ name: 'Bob', age: 30 });
    expect(withAge.success).toBe(true);

    const missingRequired = (result as z.ZodObject<z.ZodRawShape>).safeParse({ age: 30 });
    expect(missingRequired.success).toBe(false);
  });

  it('should convert array type', () => {
    const schema: Record<string, unknown> = {
      type: 'array',
      items: { type: 'string' },
    };
    const result = jsonSchemaToZod(schema);
    expect(result).toBeInstanceOf(z.ZodArray);

    const parsed = (result as z.ZodArray<z.ZodTypeAny>).safeParse(['a', 'b']);
    expect(parsed.success).toBe(true);

    const invalid = (result as z.ZodArray<z.ZodTypeAny>).safeParse([1, 2]);
    expect(invalid.success).toBe(false);
  });

  it('should handle unknown/missing type', () => {
    const result = jsonSchemaToZod({});
    expect(result).toBeInstanceOf(z.ZodUnknown);
  });

  it('should handle nested objects', () => {
    const schema: Record<string, unknown> = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            zip: { type: 'string' },
          },
        },
      },
    };
    const result = jsonSchemaToZod(schema);
    expect(result).toBeInstanceOf(z.ZodObject);

    const parsed = (result as z.ZodObject<z.ZodRawShape>).safeParse({
      address: { street: '123 Main St', zip: '12345' },
    });
    expect(parsed.success).toBe(true);
  });

  it('should make properties optional when not in required array', () => {
    const schema: Record<string, unknown> = {
      type: 'object',
      properties: {
        required_field: { type: 'string' },
        optional_field: { type: 'number' },
      },
      required: ['required_field'],
    };
    const result = jsonSchemaToZod(schema);
    // optional_field absent should still parse
    const parsed = (result as z.ZodObject<z.ZodRawShape>).safeParse({ required_field: 'hello' });
    expect(parsed.success).toBe(true);

    // required_field absent should fail
    const failed = (result as z.ZodObject<z.ZodRawShape>).safeParse({ optional_field: 42 });
    expect(failed.success).toBe(false);
  });
});

describe('skillToolToMastraTool', () => {
  it('should create a Mastra tool from a skill tool definition', () => {
    const toolDef: SkillToolDefinition = {
      name: 'search',
      description: 'Search for something',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    };

    const tool = skillToolToMastraTool('my-skill', toolDef);
    expect(tool).toBeDefined();
    expect((tool as Record<string, unknown>)._type).toBe('mastra-tool');
    expect((tool as Record<string, unknown>).description).toBe('Search for something');
  });

  it('should handle tool with no inputSchema', () => {
    const toolDef: SkillToolDefinition = {
      name: 'ping',
    };

    const tool = skillToolToMastraTool('my-skill', toolDef);
    expect(tool).toBeDefined();
    expect((tool as Record<string, unknown>)._type).toBe('mastra-tool');
  });

  it('should prefix tool id with skill name', () => {
    const toolDef: SkillToolDefinition = {
      name: 'do-thing',
      description: 'Does a thing',
    };

    const tool = skillToolToMastraTool('my-skill', toolDef);
    expect((tool as Record<string, unknown>).id).toBe('my-skill__do-thing');
  });
});

describe('loadSkillTools', () => {
  it('should return empty record for skill with no tools', () => {
    const skill: SkillDefinition = {
      name: 'empty-skill',
      description: 'A skill with no tools',
      version: '1.0.0',
      tools: [],
      config: {},
      metadata: { tags: [] },
    };

    const tools = loadSkillTools(skill);
    expect(tools).toEqual({});
  });

  it('should load all tools from a skill', () => {
    const skill: SkillDefinition = {
      name: 'my-skill',
      description: 'A skill with tools',
      version: '1.0.0',
      tools: [
        { name: 'tool-one', description: 'First tool' },
        { name: 'tool-two', description: 'Second tool' },
      ],
      config: {},
      metadata: { tags: [] },
    };

    const tools = loadSkillTools(skill);
    expect(Object.keys(tools)).toHaveLength(2);
    expect(tools['my-skill__tool-one']).toBeDefined();
    expect(tools['my-skill__tool-two']).toBeDefined();
  });

  it('should namespace tool ids with skill name', () => {
    const skill: SkillDefinition = {
      name: 'weather-skill',
      description: 'Weather tools',
      version: '2.0.0',
      tools: [{ name: 'get-forecast', description: 'Get weather forecast' }],
      config: {},
      metadata: { tags: ['weather'] },
    };

    const tools = loadSkillTools(skill);
    const toolKey = 'weather-skill__get-forecast';
    expect(tools[toolKey]).toBeDefined();
    expect((tools[toolKey] as Record<string, unknown>).id).toBe(toolKey);
  });
});
