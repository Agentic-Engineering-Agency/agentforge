import { z } from 'zod';

/**
 * Skill Creator — Built-in AgentForge Skill
 *
 * Provides tools for creating, discovering, and validating skills.
 * This skill is automatically available in every AgentForge project.
 */

// ─── Example Skills Registry ───────────────────────────────────────────
const EXAMPLE_SKILLS = [
  {
    name: 'web-search',
    description: 'Search the web for information using a search API',
    category: 'web',
    complexity: 'medium',
    template: `import { z } from 'zod';
export const tools = [{
  name: 'web-search',
  description: 'Search the web for information',
  inputSchema: z.object({ query: z.string(), maxResults: z.number().optional().default(5) }),
  outputSchema: z.object({ results: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })) }),
  handler: async (input) => {
    const response = await fetch(\`https://api.search.example/search?q=\${encodeURIComponent(input.query)}&limit=\${input.maxResults}\`);
    return { results: (await response.json()).results };
  },
}];`,
  },
  {
    name: 'calculator',
    description: 'Evaluate mathematical expressions safely',
    category: 'utility',
    complexity: 'simple',
    template: `import { z } from 'zod';

// Safe recursive descent parser - no eval/Function
function safeEvaluate(expr: string): number {
  if (!/^[0-9+\\-*/().%\\s]+$/.test(expr)) {
    throw new Error('Invalid characters');
  }
  let pos = 0;
  const peek = () => expr[pos] ?? '';
  const consume = () => expr[pos++];
  const skipWs = () => { while (peek() === ' ') consume(); };

  function parseNumber(): number {
    skipWs();
    let num = '';
    if (peek() === '(') { consume(); const v = parseExpr(); skipWs(); consume(); return v; }
    while (/[0-9.]/.test(peek())) num += consume();
    return parseFloat(num);
  }

  function parseFactor(): number {
    skipWs();
    if (peek() === '-') { consume(); return -parseFactor(); }
    return parseNumber();
  }

  function parseTerm(): number {
    let left = parseFactor();
    skipWs();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      skipWs();
      const right = parseFactor();
      left = op === '*' ? left * right : op === '/' ? left / right : left % right;
      skipWs();
    }
    return left;
  }

  function parseExpr(): number {
    let left = parseTerm();
    skipWs();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      skipWs();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
      skipWs();
    }
    return left;
  }

  return parseExpr();
}

export const tools = [{
  name: 'calculate',
  description: 'Evaluate a mathematical expression',
  inputSchema: z.object({ expression: z.string().describe('Math expression, e.g. "2 + 2 * 3"') }),
  outputSchema: z.object({ result: z.number(), expression: z.string() }),
  handler: async (input) => {
    const result = safeEvaluate(input.expression);
    return { result: Number(result), expression: input.expression };
  },
}];`,
  },
  {
    name: 'file-reader',
    description: 'Read file contents from the filesystem',
    category: 'file',
    complexity: 'simple',
    template: `import { z } from 'zod';
import { readFile } from 'fs/promises';
export const tools = [{
  name: 'read-file',
  description: 'Read the contents of a file',
  inputSchema: z.object({ path: z.string(), encoding: z.string().optional().default('utf-8') }),
  outputSchema: z.object({ content: z.string(), size: z.number() }),
  handler: async (input) => {
    const content = await readFile(input.path, input.encoding as BufferEncoding);
    return { content, size: content.length };
  },
}];`,
  },
  {
    name: 'http-request',
    description: 'Make HTTP requests to any URL',
    category: 'web',
    complexity: 'medium',
    template: `import { z } from 'zod';
export const tools = [{
  name: 'http-request',
  description: 'Make an HTTP request to any URL',
  inputSchema: z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
  }),
  outputSchema: z.object({ status: z.number(), body: z.string() }),
  handler: async (input) => {
    const res = await fetch(input.url, { method: input.method, headers: input.headers, body: input.body });
    return { status: res.status, body: await res.text() };
  },
}];`,
  },
  {
    name: 'json-transformer',
    description: 'Transform and extract data from JSON using dot-notation paths',
    category: 'data',
    complexity: 'simple',
    template: `import { z } from 'zod';
export const tools = [{
  name: 'transform-json',
  description: 'Extract data from JSON using dot-notation path',
  inputSchema: z.object({ data: z.string(), path: z.string() }),
  outputSchema: z.object({ result: z.any() }),
  handler: async (input) => {
    const obj = JSON.parse(input.data);
    let current = obj;
    for (const part of input.path.split('.')) {
      current = current?.[part] ?? current?.[Number(part)];
    }
    return { result: current };
  },
}];`,
  },
  {
    name: 'text-summarizer',
    description: 'Summarize long text into key points',
    category: 'ai',
    complexity: 'medium',
    template: `import { z } from 'zod';
export const tools = [{
  name: 'summarize',
  description: 'Summarize text into key bullet points',
  inputSchema: z.object({ text: z.string(), maxPoints: z.number().optional().default(5) }),
  outputSchema: z.object({ summary: z.string(), keyPoints: z.array(z.string()) }),
  handler: async (input) => {
    const sentences = input.text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const keyPoints = sentences.slice(0, input.maxPoints).map(s => s.trim());
    return { summary: keyPoints.join('. ') + '.', keyPoints };
  },
}];`,
  },
  {
    name: 'csv-parser',
    description: 'Parse CSV data into structured JSON',
    category: 'data',
    complexity: 'medium',
    template: `import { z } from 'zod';
export const tools = [{
  name: 'parse-csv',
  description: 'Parse CSV string into array of objects',
  inputSchema: z.object({ csv: z.string(), delimiter: z.string().optional().default(',') }),
  outputSchema: z.object({ rows: z.array(z.record(z.string())), count: z.number() }),
  handler: async (input) => {
    const lines = input.csv.trim().split('\\n');
    const headers = lines[0].split(input.delimiter).map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(input.delimiter);
      return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? '']));
    });
    return { rows, count: rows.length };
  },
}];`,
  },
];

// ─── Skill Creator Tools ───────────────────────────────────────────────
export const tools = [
  {
    name: 'create-skill',
    description:
      'Generate a new AgentForge skill from a natural language description. ' +
      'Returns the complete skill code (index.ts), config (config.json), and documentation (SKILL.md). ' +
      'The user can then review and install the skill.',
    inputSchema: z.object({
      name: z.string().describe('Skill name in kebab-case (e.g., "web-search")'),
      description: z.string().describe('What the skill should do'),
      category: z
        .enum(['utility', 'web', 'file', 'data', 'integration', 'ai', 'custom'])
        .default('custom')
        .describe('Skill category'),
      toolNames: z
        .array(z.string())
        .optional()
        .describe('Names of tools to include (optional, will be auto-generated)'),
    }),
    outputSchema: z.object({
      name: z.string(),
      indexTs: z.string(),
      configJson: z.string(),
      skillMd: z.string(),
      installCommand: z.string(),
    }),
    handler: async (input: {
      name: string;
      description: string;
      category: string;
      toolNames?: string[];
    }) => {
      const toolName = input.toolNames?.[0] ?? input.name;

      // Generate index.ts
      const indexTs = `import { z } from 'zod';

/**
 * ${input.name} — AgentForge Skill
 * ${input.description}
 */
export const tools = [
  {
    name: '${toolName}',
    description: '${input.description}',
    inputSchema: z.object({
      input: z.string().describe('Input for ${toolName}'),
    }),
    outputSchema: z.object({
      result: z.string(),
      success: z.boolean(),
    }),
    handler: async (params: { input: string }) => {
      // TODO: Implement your skill logic here
      // This is a scaffold — replace with your actual implementation
      return {
        result: \`Processed: \${params.input}\`,
        success: true,
      };
    },
  },
];

export default { tools };
`;

      // Generate config.json
      const configJson = JSON.stringify(
        {
          name: input.name,
          version: '1.0.0',
          description: input.description,
          category: input.category,
          author: 'User',
          tools: [toolName],
          dependencies: [],
          agentInstructions: `You have access to the ${input.name} skill. ${input.description}`,
        },
        null,
        2
      );

      // Generate SKILL.md
      const skillMd = `# ${input.name}

${input.description}

## Usage

### Via CLI
\`\`\`bash
agentforge skills install ${input.name}
\`\`\`

### Via Agent Chat
Ask your agent: "Use the ${toolName} tool to [your request]"

## Tools

### ${toolName}
${input.description}

**Input:**
- \`input\` (string) — Input for ${toolName}

**Output:**
- \`result\` (string) — The processed result
- \`success\` (boolean) — Whether the operation succeeded

## Configuration

Edit \`skills/${input.name}/config.json\` to customize behavior.
`;

      return {
        name: input.name,
        indexTs,
        configJson,
        skillMd,
        installCommand: `agentforge skills install ${input.name}`,
      };
    },
  },

  {
    name: 'list-examples',
    description:
      'List all available example skills with their descriptions, categories, and code templates. ' +
      'Use this to show users what kinds of skills they can create.',
    inputSchema: z.object({
      category: z
        .string()
        .optional()
        .describe('Filter by category (utility, web, file, data, ai)'),
      showCode: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include the full code template in the response'),
    }),
    outputSchema: z.object({
      examples: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          category: z.string(),
          complexity: z.string(),
          template: z.string().optional(),
        })
      ),
      count: z.number(),
    }),
    handler: async (input: { category?: string; showCode?: boolean }) => {
      let filtered = EXAMPLE_SKILLS;
      if (input.category) {
        filtered = filtered.filter((s) => s.category === input.category);
      }
      const examples = filtered.map((s) => ({
        name: s.name,
        description: s.description,
        category: s.category,
        complexity: s.complexity,
        ...(input.showCode ? { template: s.template } : {}),
      }));
      return { examples, count: examples.length };
    },
  },

  {
    name: 'validate-skill',
    description:
      'Validate a skill definition to ensure it has the correct structure, ' +
      'required fields, and valid Zod schemas before installation.',
    inputSchema: z.object({
      name: z.string().describe('Skill name to validate'),
      indexTs: z.string().describe('The index.ts file content'),
      configJson: z.string().describe('The config.json file content'),
    }),
    outputSchema: z.object({
      isValid: z.boolean(),
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
    }),
    handler: async (input: {
      name: string;
      indexTs: string;
      configJson: string;
    }) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate name
      if (!/^[a-z][a-z0-9-]*$/.test(input.name)) {
        errors.push(
          'Skill name must be kebab-case (lowercase letters, numbers, hyphens)'
        );
      }

      // Validate index.ts
      if (!input.indexTs.includes('export')) {
        errors.push('index.ts must have at least one export');
      }
      if (!input.indexTs.includes('tools')) {
        errors.push('index.ts must export a tools array');
      }
      if (!input.indexTs.includes('handler')) {
        errors.push('Each tool must have a handler function');
      }
      if (!input.indexTs.includes('inputSchema')) {
        warnings.push(
          'Tools should define inputSchema for type safety'
        );
      }
      if (!input.indexTs.includes('outputSchema')) {
        warnings.push(
          'Tools should define outputSchema for type safety'
        );
      }

      // Validate config.json
      try {
        const config = JSON.parse(input.configJson);
        if (!config.name) errors.push('config.json must have a "name" field');
        if (!config.version)
          errors.push('config.json must have a "version" field');
        if (!config.description)
          warnings.push('config.json should have a "description" field');
        if (!config.category)
          warnings.push('config.json should have a "category" field');
      } catch {
        errors.push('config.json is not valid JSON');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    },
  },
];

export default { tools };
