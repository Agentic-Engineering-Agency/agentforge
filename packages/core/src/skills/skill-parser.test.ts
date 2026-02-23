import { describe, it, expect } from 'vitest';
import { parseSkillManifest } from './skill-parser.js';
import { SkillParseError } from './types.js';
import type { SkillDefinition } from './types.js';

const MINIMAL_SKILL_MD = `---
name: my-skill
description: A minimal skill for testing
version: 1.0.0
---

# My Skill

Some documentation here.
`;

const FULL_SKILL_MD = `---
name: web-search
description: Search the web for information
version: 2.1.3
tools:
  - name: search
    description: Perform a web search
    inputSchema:
      type: object
      properties:
        query:
          type: string
  - name: fetch-page
    description: Fetch a web page
config:
  maxResults: 10
  timeout: 5000
metadata:
  author: AgentForge Team
  license: Apache-2.0
  repository: https://github.com/agentforge/web-search
  tags:
    - web
    - search
    - information-retrieval
---

# Web Search Skill

Documentation here.
`;

describe('parseSkillManifest', () => {
  it('should parse a valid minimal SKILL.md', () => {
    const result: SkillDefinition = parseSkillManifest(MINIMAL_SKILL_MD);
    expect(result.name).toBe('my-skill');
    expect(result.description).toBe('A minimal skill for testing');
    expect(result.version).toBe('1.0.0');
  });

  it('should parse a full SKILL.md with all fields', () => {
    const result: SkillDefinition = parseSkillManifest(FULL_SKILL_MD);
    expect(result.name).toBe('web-search');
    expect(result.description).toBe('Search the web for information');
    expect(result.version).toBe('2.1.3');
  });

  it('should throw SkillParseError for missing frontmatter', () => {
    const content = `# My Skill\n\nNo frontmatter here.`;
    expect(() => parseSkillManifest(content)).toThrow(SkillParseError);
    expect(() => parseSkillManifest(content)).toThrow(/frontmatter/i);
  });

  it('should throw SkillParseError for missing name', () => {
    const content = `---\ndescription: A skill\nversion: 1.0.0\n---\n`;
    expect(() => parseSkillManifest(content)).toThrow(SkillParseError);
  });

  it('should throw SkillParseError for missing description', () => {
    const content = `---\nname: my-skill\nversion: 1.0.0\n---\n`;
    expect(() => parseSkillManifest(content)).toThrow(SkillParseError);
  });

  it('should throw SkillParseError for missing version', () => {
    const content = `---\nname: my-skill\ndescription: A skill\n---\n`;
    expect(() => parseSkillManifest(content)).toThrow(SkillParseError);
  });

  it('should throw SkillParseError for invalid name format', () => {
    const content = `---\nname: MySkill\ndescription: A skill\nversion: 1.0.0\n---\n`;
    expect(() => parseSkillManifest(content)).toThrow(SkillParseError);
    expect(() => parseSkillManifest(content)).toThrow(/name/i);
  });

  it('should throw SkillParseError for invalid version format', () => {
    const content = `---\nname: my-skill\ndescription: A skill\nversion: v1.0\n---\n`;
    expect(() => parseSkillManifest(content)).toThrow(SkillParseError);
    expect(() => parseSkillManifest(content)).toThrow(/version/i);
  });

  it('should use defaults for optional fields', () => {
    const result = parseSkillManifest(MINIMAL_SKILL_MD);
    expect(result.tools).toEqual([]);
    expect(result.config).toEqual({});
    expect(result.metadata).toEqual({ tags: [] });
  });

  it('should parse tools array correctly', () => {
    const result = parseSkillManifest(FULL_SKILL_MD);
    expect(result.tools).toHaveLength(2);
    expect(result.tools[0].name).toBe('search');
    expect(result.tools[0].description).toBe('Perform a web search');
    expect(result.tools[0].inputSchema).toBeDefined();
    expect(result.tools[1].name).toBe('fetch-page');
    expect(result.tools[1].description).toBe('Fetch a web page');
  });

  it('should parse metadata correctly', () => {
    const result = parseSkillManifest(FULL_SKILL_MD);
    expect(result.metadata.author).toBe('AgentForge Team');
    expect(result.metadata.license).toBe('Apache-2.0');
    expect(result.metadata.repository).toBe('https://github.com/agentforge/web-search');
    expect(result.metadata.tags).toEqual(['web', 'search', 'information-retrieval']);
  });

  it('should throw SkillParseError for empty content', () => {
    expect(() => parseSkillManifest('')).toThrow(SkillParseError);
    expect(() => parseSkillManifest('   ')).toThrow(SkillParseError);
  });

  it('should parse config values correctly', () => {
    const result = parseSkillManifest(FULL_SKILL_MD);
    expect(result.config).toEqual({ maxResults: 10, timeout: 5000 });
  });

  it('should handle skill names with numbers and hyphens', () => {
    const content = `---\nname: skill-2-v3\ndescription: A skill\nversion: 1.0.0\n---\n`;
    const result = parseSkillManifest(content);
    expect(result.name).toBe('skill-2-v3');
  });

  it('should throw SkillParseError for name starting with number', () => {
    const content = `---\nname: 2skill\ndescription: A skill\nversion: 1.0.0\n---\n`;
    expect(() => parseSkillManifest(content)).toThrow(SkillParseError);
  });

  it('should handle tools without description or inputSchema', () => {
    const content = `---
name: my-skill
description: A skill
version: 1.0.0
tools:
  - name: simple-tool
---
`;
    const result = parseSkillManifest(content);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('simple-tool');
    expect(result.tools[0].description).toBeUndefined();
    expect(result.tools[0].inputSchema).toBeUndefined();
  });

  it('should handle only-tags metadata', () => {
    const content = `---
name: my-skill
description: A skill
version: 1.0.0
metadata:
  tags:
    - alpha
    - beta
---
`;
    const result = parseSkillManifest(content);
    expect(result.metadata.tags).toEqual(['alpha', 'beta']);
    expect(result.metadata.author).toBeUndefined();
  });
});
