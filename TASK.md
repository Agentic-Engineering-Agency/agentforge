# TASK: SPEC-020 — AgentForge Runtime Package

You are Agent A. Your job is to implement SPEC-020: create `packages/runtime/` — the Mastra persistent daemon that replaces all LLM logic currently broken inside Convex actions.

## CRITICAL: Read These First
Before writing any code, read these files in the repo:
- `CLAUDE.md` — project rules (mandatory)
- `docs/TECH-REFERENCE.md` — Convex + Mastra technical constraints (critical)
- `specs/active/SPEC-020-runtime-package.md` — your spec

## Context: What AgentForge Is
A self-hosted AI agent framework — a central daemon (like OpenClaw) that runs multiple agents, serves HTTP/Discord/Telegram channels. The current codebase has Mastra running inside Convex actions — this is wrong and causes 10-15s latency. Your job is to build the correct runtime package.

## Your Branch
You are already on branch `feat/spec-020-runtime`. All work goes here.
**NEVER push to main. Never push to plan/architecture-redesign.**

## SpecSafe Workflow (MANDATORY)
1. Write tests FIRST (watch them fail — proves tests are real)
2. Implement
3. `pnpm test` — must be GREEN
4. Fix failures immediately — never move on with red tests
5. Commit and push

## What To Build

### Package: `packages/runtime/`
New package. Create from scratch.

```
packages/runtime/
├── package.json          # @agentforge-ai/runtime, version 0.1.0, ESM
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                        # public exports
│   ├── agent/
│   │   ├── create-standard-agent.ts   # createStandardAgent() factory
│   │   └── shared.ts                  # constants + ConvexStore + createStandardMemory()
│   ├── models/
│   │   └── registry.ts                # full model registry
│   ├── tools/
│   │   ├── datetime.ts                # get-current-datetime tool
│   │   ├── web-search.ts              # web-search tool (Brave API)
│   │   ├── read-url.ts                # read-url tool (jsdom + Readability)
│   │   └── manage-notes.ts            # manage-notes tool (persistent JSON)
│   └── daemon/
│       ├── types.ts                   # DaemonConfig, ChannelAdapter interface, AgentDefinition
│       └── daemon.ts                  # AgentForgeDaemon class
└── tests/
    ├── agent-factory.test.ts
    ├── model-registry.test.ts
    └── tools.test.ts
```

### `package.json`
```json
{
  "name": "@agentforge-ai/runtime",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mastra/core": "^1.8.0",
    "@mastra/memory": "^1.5.0",
    "@mastra/convex": "latest",
    "@ai-sdk/moonshotai": "^2.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^3.0.0",
    "tsup": "^8.0.0"
  }
}
```

### `src/agent/shared.ts`
```typescript
import { ConvexStore } from '@mastra/convex'
import { ConvexVector } from '@mastra/convex'
import { Memory } from '@mastra/memory'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'
import { UnicodeNormalizer, TokenLimiterProcessor } from '@mastra/core/processors'

export const DAEMON_MODEL = 'moonshotai/kimi-k2.5'
export const OBSERVER_MODEL = 'google/gemini-2.5-flash'
export const EMBEDDING_MODEL = 'google/gemini-embedding-001'
export const DEFAULT_TOKEN_LIMIT = 100_000

export interface StandardMemoryOptions {
  lastMessages?: number
  semanticRecall?: { topK: number; messageRange: number; scope: 'resource' | 'thread' }
  workingMemoryTemplate?: string
  observationalMemory?: { observation?: { messageTokens: number }; reflection?: { observationTokens: number } } | false
}

// Initialized at daemon startup — singletons shared across all agents
let _storage: ConvexStore | null = null
let _vector: ConvexVector | null = null

export function initStorage(deploymentUrl: string, adminAuthToken: string): void {
  _storage = new ConvexStore({ id: 'agentforge-storage', deploymentUrl, adminAuthToken })
  _vector = new ConvexVector({ id: 'agentforge-vectors', deploymentUrl, adminAuthToken })
}

export function getStorage(): ConvexStore {
  if (!_storage) throw new Error('Storage not initialized. Call initStorage() first.')
  return _storage
}

export function getVector(): ConvexVector {
  if (!_vector) throw new Error('Vector not initialized. Call initStorage() first.')
  return _vector
}

export function createStandardMemory(opts?: StandardMemoryOptions): Memory {
  const options = opts ?? {}
  // ... build Memory instance with storage, vector, embedder
}
```

### `src/agent/create-standard-agent.ts`
```typescript
import { Agent, type ToolsInput } from '@mastra/core/agent'
import { UnicodeNormalizer, TokenLimiterProcessor } from '@mastra/core/processors'
import { DAEMON_MODEL, DEFAULT_TOKEN_LIMIT, createStandardMemory } from './shared.js'

export interface StandardAgentConfig {
  id: string
  name: string
  description?: string
  instructions: string
  model?: string
  tools?: ToolsInput
  workingMemoryTemplate?: string
  disableMemory?: boolean
  disableObservationalMemory?: boolean
}

export function createStandardAgent(config: StandardAgentConfig): Agent {
  // Use DAEMON_MODEL if not specified
  // Create memory via createStandardMemory()
  // Add UnicodeNormalizer + TokenLimiterProcessor as inputProcessors
  // Return new Agent({ id, name, model, memory, tools, inputProcessors, instructions })
}
```

### `src/models/registry.ts`
Full model registry with providers: openai, anthropic, google, mistral, deepseek, xai, openrouter, cohere, moonshotai.

Each model entry:
```typescript
interface ModelEntry {
  id: string           // "moonshotai/kimi-k2.5"
  displayName: string
  provider: string
  contextWindow: number
  maxOutputTokens?: number
  costPerMInput: number    // USD per million input tokens
  costPerMOutput: number   // USD per million output tokens
  tier: 'free' | 'budget' | 'standard' | 'premium'
  capabilities: Set<'chat' | 'vision' | 'code' | 'long-context' | 'embedding' | 'structured-output'>
  roles: Set<'agent' | 'observer' | 'guardrail' | 'embedding'>
  active: boolean
}
```

Functions:
- `getModel(id: string): ModelEntry | undefined`
- `getModelsByProvider(provider: string): ModelEntry[]`
- `getModelsByRole(role: string): ModelEntry[]`
- `getActiveModels(): ModelEntry[]`
- `getContextLimit(modelId: string): number` — returns context window, default 100_000

Include real current models:
- OpenAI: gpt-5.1, gpt-5.1-mini, gpt-4.1, gpt-4.1-mini, gpt-4o, gpt-4o-mini, o3, o4-mini
- Anthropic: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5
- Google: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-3.1-flash-lite-preview
- Mistral: mistral-large-latest, mistral-small-latest
- DeepSeek: deepseek-chat, deepseek-reasoner
- xAI: grok-3, grok-3-mini
- OpenRouter: (pass-through, use as proxy)
- Cohere: command-r-plus, command-r
- MoonshotAI: kimi-k2.5 (DAEMON_MODEL — budget tier, 128K context)

### Tools

**datetime tool** — returns current date/time in user timezone
```typescript
export const datetimeTool = createTool({
  id: 'get-current-datetime',
  description: 'Get the current date and time.',
  inputSchema: z.object({ timezone: z.string().optional() }),
  outputSchema: z.object({ datetime: z.string(), timezone: z.string() }),
  execute: async ({ timezone }) => { ... }
})
```

**web-search tool** — Brave Search API
```typescript
// Uses env: BRAVE_API_KEY
// Falls back to message "web search unavailable" if key not set
export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for current information.',
  inputSchema: z.object({ query: z.string(), count: z.number().optional() }),
  outputSchema: z.object({ results: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })) }),
  execute: async ({ query, count = 5 }) => { ... }
})
```

**read-url tool** — jsdom + @mozilla/readability
```typescript
// npm deps: jsdom, @mozilla/readability
export const readUrlTool = createTool({
  id: 'read-url',
  description: 'Read and extract text content from a URL.',
  inputSchema: z.object({ url: z.string() }),
  outputSchema: z.object({ title: z.string(), content: z.string(), excerpt: z.string() }),
  execute: async ({ url }) => { ... }
})
```

**manage-notes tool** — CRUD on `data/notes.json`
```typescript
export const managNotesTool = createTool({
  id: 'manage-notes',
  description: 'Create, read, update, delete persistent notes.',
  inputSchema: z.object({
    action: z.enum(['create', 'read', 'update', 'delete', 'list']),
    id: z.string().optional(),
    content: z.string().optional(),
    title: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), notes: z.array(z.any()).optional(), note: z.any().optional() }),
  execute: async ({ action, id, content, title }) => { ... }
})
```

### `src/daemon/types.ts`
```typescript
export interface ChannelAdapter {
  name: string
  start(agents: Map<string, Agent>, daemon: AgentForgeDaemon): Promise<void>
  stop(): Promise<void>
}

export interface AgentDefinition {
  id: string
  name: string
  description?: string
  instructions: string
  model?: string
  tools?: string[]    // tool IDs to attach
  workingMemoryTemplate?: string
}

export interface DaemonConfig {
  deploymentUrl?: string    // Convex URL for ConvexStore memory
  adminAuthToken?: string   // Convex admin key
  defaultModel?: string
}
```

### `src/daemon/daemon.ts`
```typescript
export class AgentForgeDaemon {
  private agents = new Map<string, Agent>()
  private channels: ChannelAdapter[] = []

  constructor(config: DaemonConfig) {
    if (config.deploymentUrl && config.adminAuthToken) {
      initStorage(config.deploymentUrl, config.adminAuthToken)
    }
  }

  async loadAgents(definitions: AgentDefinition[]): Promise<void>
  addChannel(adapter: ChannelAdapter): void
  async start(): Promise<void>          // starts all channels
  async stop(): Promise<void>           // graceful shutdown
  getAgent(id: string): Agent | undefined
  listAgents(): AgentDefinition[]
}
```

## Tests to Write (write these BEFORE implementing)

### `tests/agent-factory.test.ts`
- `createStandardAgent()` returns an Agent instance
- Agent has correct id, name, instructions
- Agent uses DAEMON_MODEL when no model specified
- Agent uses custom model when specified
- Agent has UnicodeNormalizer in inputProcessors
- Agent has TokenLimiterProcessor in inputProcessors

### `tests/model-registry.test.ts`
- `getModel('moonshotai/kimi-k2.5')` returns correct entry
- `getModelsByProvider('openai')` returns >0 models, all with provider 'openai'
- `getActiveModels()` returns only active models
- `getContextLimit('openai/gpt-5.1')` returns a positive number
- Each model has required fields: id, displayName, provider, contextWindow, tier
- No deprecated model IDs (no claude-3-5-haiku-20241022, no gpt-4-turbo, etc.)

### `tests/tools.test.ts`
- `datetimeTool.execute({})` returns object with datetime string
- `webSearchTool.execute({ query: 'test' })` returns object with results array (mock BRAVE_API_KEY)
- `readUrlTool.execute({ url: 'https://example.com' })` extracts title and content
- `managNotesTool.execute({ action: 'create', title: 'test', content: 'hello' })` returns success: true
- `managNotesTool.execute({ action: 'list' })` returns notes array

## Quality Gates (MANDATORY before PR)
- `pnpm test` — ALL passing (target: 30+ tests)
- `tsc --noEmit` — 0 TypeScript errors
- `pnpm build` — builds without errors
- Zero hardcoded secrets

## When Done
1. Commit all changes: `git add -A && git commit -m "feat(runtime): SPEC-020 — runtime package with createStandardAgent, ConvexStore memory, model registry, tools, daemon"`
2. Push: `git push -u origin feat/spec-020-runtime`
3. Notify: `openclaw system event --text "SPEC-020 complete: packages/runtime/ built — createStandardAgent, ConvexStore memory, 9-provider model registry, 4 tools, AgentForgeDaemon. Tests passing. PR ready." --mode now`

## Key Technical Constraints
- ESM only (`"type": "module"`)
- All imports must use `.js` extension (TypeScript ESM)
- `createTool` from `@mastra/core/tools` (NOT `@mastra/core`)
- `execute` receives `inputData` directly, NOT `{ context }` 
- `ConvexStore` and `ConvexVector` from `@mastra/convex`
- Do NOT use `@mastra/libsql` — central daemon uses ConvexStore
- Do NOT use `@convex-dev/mastra` — that's a different package for running Mastra inside Convex
- Model string format: `"provider/model-id"` (e.g., `"moonshotai/kimi-k2.5"`)
