# Skill Creator

**Built-in AgentForge Skill** — Create, manage, and discover skills for your agents.

## Overview

The Skill Creator is a default skill that ships with every AgentForge project. It allows you to:

1. **Create new skills** from natural language descriptions
2. **Browse example skills** to understand the skill format
3. **Validate skills** before installing them
4. **Generate skill code** using your connected LLM

## Usage

### Via CLI

```bash
# Create a new skill interactively
agentforge skills create

# Ask the agent to create a skill
agentforge chat my-agent
> Create a skill that can fetch weather data for any city

# List available example skills
agentforge skills search examples
```

### Via Dashboard

Navigate to **Skills** in the sidebar, then click **"Create Skill"** to use the visual skill builder.

### Via Agent Chat

When chatting with an agent that has the Skill Creator tool enabled, simply ask:

> "Create a skill that can [description of what you want]"

The agent will generate the skill definition, validate it, and offer to install it.

## Skill Format

Every AgentForge skill is a directory with the following structure:

```
skills/
  my-skill/
    SKILL.md          # Documentation and instructions
    index.ts          # Main skill entry point
    config.json       # Skill metadata and configuration
```

### config.json

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "What this skill does",
  "category": "utility",
  "author": "Your Name",
  "tools": ["tool-name-1", "tool-name-2"],
  "dependencies": [],
  "agentInstructions": "Additional instructions for agents using this skill"
}
```

### index.ts

```typescript
import { z } from 'zod';

export const tools = [
  {
    name: 'my-tool',
    description: 'What this tool does',
    inputSchema: z.object({
      param1: z.string().describe('Description of param1'),
    }),
    outputSchema: z.object({
      result: z.string(),
    }),
    handler: async (input: { param1: string }) => {
      // Your tool logic here
      return { result: `Processed: ${input.param1}` };
    },
  },
];

export default { tools };
```

## Example Skills

### 1. Web Search Skill

```typescript
// skills/web-search/index.ts
import { z } from 'zod';

export const tools = [
  {
    name: 'web-search',
    description: 'Search the web for information',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      maxResults: z.number().optional().default(5),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      })),
    }),
    handler: async (input) => {
      // Implement with your preferred search API
      const response = await fetch(
        `https://api.search.example/search?q=${encodeURIComponent(input.query)}&limit=${input.maxResults}`
      );
      const data = await response.json();
      return { results: data.results };
    },
  },
];
```

### 2. Calculator Skill

```typescript
// skills/calculator/index.ts
import { z } from 'zod';

export const tools = [
  {
    name: 'calculate',
    description: 'Evaluate a mathematical expression',
    inputSchema: z.object({
      expression: z.string().describe('Math expression to evaluate (e.g., "2 + 2 * 3")'),
    }),
    outputSchema: z.object({
      result: z.number(),
      expression: z.string(),
    }),
    handler: async (input) => {
      const result = Function('"use strict"; return (' + input.expression + ')')();
      return { result: Number(result), expression: input.expression };
    },
  },
];
```

### 3. File Reader Skill

```typescript
// skills/file-reader/index.ts
import { z } from 'zod';
import { readFile } from 'fs/promises';

export const tools = [
  {
    name: 'read-file',
    description: 'Read the contents of a file',
    inputSchema: z.object({
      path: z.string().describe('Path to the file'),
      encoding: z.string().optional().default('utf-8'),
    }),
    outputSchema: z.object({
      content: z.string(),
      size: z.number(),
    }),
    handler: async (input) => {
      const content = await readFile(input.path, input.encoding as BufferEncoding);
      return { content, size: content.length };
    },
  },
];
```

### 4. JSON Transformer Skill

```typescript
// skills/json-transformer/index.ts
import { z } from 'zod';

export const tools = [
  {
    name: 'transform-json',
    description: 'Transform JSON data using a jq-like expression',
    inputSchema: z.object({
      data: z.string().describe('JSON string to transform'),
      path: z.string().describe('Dot-notation path to extract (e.g., "users.0.name")'),
    }),
    outputSchema: z.object({
      result: z.any(),
    }),
    handler: async (input) => {
      const obj = JSON.parse(input.data);
      const parts = input.path.split('.');
      let current: any = obj;
      for (const part of parts) {
        current = current?.[part] ?? current?.[Number(part)];
      }
      return { result: current };
    },
  },
];
```

### 5. HTTP Request Skill

```typescript
// skills/http-request/index.ts
import { z } from 'zod';

export const tools = [
  {
    name: 'http-request',
    description: 'Make an HTTP request to any URL',
    inputSchema: z.object({
      url: z.string().url().describe('URL to request'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
      headers: z.record(z.string()).optional(),
      body: z.string().optional(),
    }),
    outputSchema: z.object({
      status: z.number(),
      body: z.string(),
      headers: z.record(z.string()),
    }),
    handler: async (input) => {
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
      });
      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
      return { status: response.status, body, headers };
    },
  },
];
```

## Creating Skills with AI

When you ask an agent to create a skill, the Skill Creator tool will:

1. **Parse your request** — Understand what the skill should do
2. **Generate the code** — Create `index.ts` with proper Zod schemas
3. **Create metadata** — Generate `config.json` with name, description, category
4. **Write documentation** — Generate `SKILL.md` with usage instructions
5. **Validate** — Ensure the skill compiles and schemas are correct
6. **Install** — Save to your `skills/` directory and register with Convex

## Categories

Skills are organized by category:

| Category | Description | Examples |
|----------|-------------|---------|
| `utility` | General-purpose tools | Calculator, JSON transformer |
| `web` | Web interaction | HTTP requests, web search, scraping |
| `file` | File operations | Read, write, transform files |
| `data` | Data processing | CSV parsing, data analysis |
| `integration` | External services | Slack, GitHub, email |
| `ai` | AI-powered tools | Summarization, translation |
| `custom` | User-defined | Anything else |
