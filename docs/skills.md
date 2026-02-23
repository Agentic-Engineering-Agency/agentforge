# Skills

Skills extend your agent's capabilities. A skill is a self-contained package that defines tools, instructions, and configuration that can be installed into any AgentForge agent.

## Built-in Skills

AgentForge ships with 6 built-in skills:

| Skill | Description |
|-------|-------------|
| `web-search` | Search the web for information |
| `file-manager` | Read, write, list, and manage workspace files |
| `code-review` | Systematically review code for bugs and style issues |
| `data-analyst` | Analyze structured data in CSV and JSON formats |
| `api-tester` | Test REST APIs with configurable requests |
| `git-workflow` | Automate Git operations (branch, commit, diff, log) |

## Managing Skills

### List installed skills

```bash
agentforge skills
```

### Install a skill

```bash
agentforge skill install <name>
```

### Remove a skill

```bash
agentforge skill remove <name>
```

## Skill Format

A skill is a directory containing a `SKILL.md` file:

```
my-skill/
├── SKILL.md          # Skill definition (required)
├── tools/            # Tool implementations (optional)
│   └── my-tool.ts
└── config.json       # Default configuration (optional)
```

### SKILL.md

The `SKILL.md` file defines the skill using frontmatter:

```markdown
---
name: my-custom-skill
description: A skill that does something useful
version: 1.0.0
metadata:
  author: your-name
  license: MIT
  tags:
    - utility
    - automation
---

## Instructions

You have access to the `my-tool` tool. Use it when the user asks to...

## Tools

### my-tool

**Description:** Does something useful

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The input query"
    }
  },
  "required": ["query"]
}
```
```

### Skill naming

- Names must be **kebab-case** (e.g., `web-search`, `my-custom-skill`)
- Names must be unique within a project

### Versioning

Skills use [semantic versioning](https://semver.org):

- `1.0.0` — initial release
- `1.1.0` — new features, backward compatible
- `2.0.0` — breaking changes

## Writing a Custom Skill

### 1. Create the skill directory

```bash
mkdir -p skills/my-skill
```

### 2. Write the SKILL.md

```markdown
---
name: weather-lookup
description: Look up current weather for any city
version: 1.0.0
metadata:
  author: your-name
  tags:
    - weather
    - utility
tools:
  - name: get-weather
    description: Get current weather for a city
    inputSchema:
      type: object
      properties:
        city:
          type: string
          description: City name
      required:
        - city
---

## Instructions

When the user asks about weather, use the `get-weather` tool with the city name.
Report temperature, conditions, and humidity.
```

### 3. Implement the tool

If your skill has tools that need implementation, create them in the `tools/` directory:

```typescript
// skills/weather-lookup/tools/get-weather.ts
export async function execute(input: { city: string }) {
  const response = await fetch(
    `https://api.weather.example/v1/current?city=${encodeURIComponent(input.city)}`
  );
  const data = await response.json();
  return {
    temperature: data.temp,
    conditions: data.description,
    humidity: data.humidity,
  };
}
```

### 4. Register the skill in your config

```typescript
// agentforge.config.ts
export default defineConfig({
  agents: [{
    name: 'my-agent',
    model: 'openai/gpt-4o',
    skills: ['web-search', 'weather-lookup'],
  }],
});
```

## Publishing to Marketplace

Share your skill with the community:

```bash
agentforge skill publish
```

This packages your skill directory and publishes it to the AgentForge skill marketplace. Other users can then install it with:

```bash
agentforge skill install weather-lookup
```

### Publish requirements

- `SKILL.md` must have `name`, `description`, `version`, and `metadata.author`
- The skill must not contain secrets or hardcoded API keys
- Tool implementations must be self-contained (no external file references outside the skill directory)

## Skill Discovery

The skill system supports programmatic discovery:

```typescript
import { SkillDiscovery, SkillRegistry } from '@agentforge-ai/core';

// Discover skills in a directory
const skills = await SkillDiscovery.scan('./skills');

// Register with the skill registry
const registry = new SkillRegistry();
for (const skill of skills) {
  registry.register(skill);
}
```

## How Skills Work Internally

1. **Parsing**: `SKILL.md` frontmatter is parsed into a `SkillDefinition` (validated with Zod)
2. **Tool conversion**: Skill tools are converted to Mastra-compatible tools via `skillToolToMastraTool()`
3. **Registration**: Tools are registered with the agent's tool registry (ID format: `${skillName}__${toolName}`)
4. **Execution**: When the LLM calls a skill tool, the tool executor runs the implementation
