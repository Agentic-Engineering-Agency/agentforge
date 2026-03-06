# AgentForge — Technical Reference

> **For coding agents and developers.** Read this before touching any Convex or Mastra code.
> Referenced by: `CLAUDE.md`, `AGENTS.md`
> Last updated: 2026-03-05
> Sources: docs.convex.dev, mastra.ai/docs, github.com/get-convex/mastra, mastra.ai/reference/storage/convex

---

## 1. Convex — How It Actually Works

### Two Runtimes

| | Default (V8) | Node.js (`"use node"`) |
|---|---|---|
| **Cold starts** | ❌ None — always warm | ✅ Yes — first call is slow |
| **Use case** | queries, mutations | actions with Node.js-only APIs |
| **node:crypto** | ❌ Not available | ✅ Available |
| **fetch()** | ✅ Actions only | ✅ Actions only |
| **WebCrypto (SubtleCrypto)** | ✅ Available (but async — slow for PBKDF2/HKDF) | ✅ Available |
| **Determinism required** | ✅ Queries + mutations only | ❌ Actions are non-deterministic |
| **Function types allowed** | query, mutation, action, internalQuery, internalMutation, internalAction | action, internalAction **ONLY** |
| **LLM calls** | ❌ Never | ✅ Actions only |
| **Mastra runtime** | ❌ Cannot run | ✅ Can run (but cold starts — use external daemon instead) |

### The Golden Rule
```
"use node" files → ONLY action / internalAction functions
Default runtime  → query, mutation, internalQuery, internalMutation
```
**Violating this causes a Convex deploy error.** No exceptions.

### Determinism Constraint (Queries + Mutations)
Queries and mutations must be **deterministic**: same input → same output, always. They cannot:
- Call external APIs
- Use `Date.now()` / `Math.random()` (use Convex's seeded versions)
- Run LLM calls
- Use Node.js-only modules

### Convex Best Practices

#### Use indexes, not `.filter()`
```typescript
// ❌ Wrong — scans entire table
const msgs = await ctx.db.query("messages")
  .filter(q => q.eq(q.field("author"), userId))
  .collect()

// ✅ Correct — indexed lookup
const msgs = await ctx.db.query("messages")
  .withIndex("by_author", q => q.eq("author", userId))
  .collect()
```

#### `.collect()` is dangerous on large tables
Only call `.collect()` when the result set is guaranteed small. For potentially large sets, use pagination (`.paginate()`) or a filtered index.

#### Always await all promises
```typescript
// ❌ Wrong — scheduler call is a floating promise
ctx.scheduler.runAfter(0, internal.jobs.process, {})

// ✅ Correct
await ctx.scheduler.runAfter(0, internal.jobs.process, {})
```

#### Internal vs public functions
```typescript
// ✅ Internal — only callable by other Convex functions
await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider })

// ❌ Wrong — api.* is for public (client-facing) functions only
await ctx.runQuery(api.apiKeys.getDecryptedForProvider, { provider })
```

#### File storage
```typescript
// ✅ Real file storage
const uploadUrl = await ctx.storage.generateUploadUrl()

// ❌ Never fake it
url: 'pending-upload'
```

---

## 2. Mastra — Core Concepts

### Agent API

```typescript
import { Agent } from '@mastra/core/agent'

const agent = new Agent({
  id: 'my-agent',           // required — kebab-case
  name: 'My Agent',         // required — display name
  model: 'openai/gpt-5.1',  // provider/model format
  instructions: 'You are a helpful assistant.',
  tools: { 'my-tool': myTool },
  memory,                   // Memory instance
  inputProcessors: [...],
  outputProcessors: [...],
})

// Register with Mastra instance
const mastra = new Mastra({ agents: { myAgent: agent } })

// Get agent reference (preferred — provides Mastra context)
const agent = mastra.getAgent('myAgent')
```

### Model String Format
```
provider/model-id

Examples:
  openai/gpt-5.1
  anthropic/claude-opus-4-6
  google/gemini-2.5-flash
  moonshotai/kimi-k2.5
  mistral/mistral-large-latest
  deepseek/deepseek-chat
```
The model router auto-detects env vars for each provider (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).
For BYOK (Bring Your Own Key), inject via `process.env` before creating the Agent (in Node.js actions):
```typescript
process.env['OPENAI_API_KEY'] = decryptedKey
```

### Dynamic Instructions
```typescript
// Instructions can be an async function — resolved per request
instructions: async (runtimeContext) => {
  const user = await loadUser(runtimeContext.userId)
  return `You are helping ${user.name}.`
}
```

### Generating Responses
```typescript
// Streaming (preferred for channels)
const stream = await agent.stream(messages, { threadId, resourceId })
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.payload.text)
}

// Non-streaming
const result = await agent.generate(messages, { threadId, resourceId })
console.log(result.text)
```

### 4 Memory Types

| Type | Description | Storage required | Vector required |
|------|-------------|-----------------|-----------------|
| **Message history** | Recent messages in context window | ✅ | ❌ |
| **Working memory** | Structured user data (name, prefs, goals) | ✅ | ❌ |
| **Semantic recall** | Retrieve old messages by meaning | ✅ | ✅ |
| **Observational memory** | Background Observer+Reflector compresses history | ✅ | ✅ |

```typescript
import { Memory } from '@mastra/memory'

const memory = new Memory({
  storage,    // storage adapter (e.g., ConvexStore, LibSQLStore)
  vector,     // vector adapter for semantic recall (e.g., ConvexVector)
  embedder,   // embedding model
  options: {
    lastMessages: 20,
    semanticRecall: { topK: 3, messageRange: 2, scope: 'resource' },
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: '# User\n- Name:\n- Preferences:\n',
    },
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      scope: 'thread',
      observation: { messageTokens: 30_000 },
      reflection: { observationTokens: 40_000 },
    },
  },
})
```

### Memory Processors (context window management)
```typescript
import { UnicodeNormalizer, TokenLimiterProcessor } from '@mastra/core/processors'

inputProcessors: [
  new UnicodeNormalizer({ stripControlChars: true, collapseWhitespace: true }),
  new TokenLimiterProcessor({ limit: 100_000, strategy: 'truncate', countMode: 'cumulative' }),
]
```

### Tools
```typescript
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const myTool = createTool({
  id: 'my-tool',
  description: 'Does something useful.',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ query }) => {    // NOTE: inputData directly, NOT { context }
    return { result: await fetchSomething(query) }
  },
})
```

### Workflows
```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows'

const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => ({ result: inputData.message.toUpperCase() }),
})

const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(step1)
  .commit()
```

Workflows support: `.then()` (sequential), `.parallel()` (fan-out), `.branch()` (conditional), `.loop()`, `.map()`, suspend/resume for human-in-the-loop.

---

## 3. The Right Way: `@mastra/convex` (ConvexStore + ConvexVector)

**This is the correct integration for AgentForge's daemon architecture.**

`@mastra/convex` is an external HTTP client — the **Mastra runtime calls Convex** to persist memory. NOT the other way around.

### Why ConvexStore over LibSQL
- Memory is persisted to Convex → visible in the real-time dashboard
- No local SQLite file to manage per deployment
- Works correctly in the central daemon model (shared across all agents)

### Setup

#### 1. Convex schema (`convex/schema.ts`)
```typescript
import { defineSchema } from 'convex/server'
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraVectorIndexesTable,
  mastraVectorsTable,
  mastraDocumentsTable,
} from '@mastra/convex/schema'

export default defineSchema({
  // Mastra memory tables
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_vectors: mastraVectorsTable,
  mastra_documents: mastraDocumentsTable,
  // AgentForge config tables
  agents: agentsTable,
  apiKeys: apiKeysTable,
  // ... etc
})
```

#### 2. Storage handler (`convex/mastra/storage.ts`)
```typescript
import { mastraStorage } from '@mastra/convex/server'
export const handle = mastraStorage
```

#### 3. Deploy schema
```bash
npx convex dev    # development
npx convex deploy # production
```

#### 4. Runtime usage (in `packages/runtime/`)
```typescript
import { ConvexStore } from '@mastra/convex'
import { ConvexVector } from '@mastra/convex'

const storage = new ConvexStore({
  id: 'agentforge-storage',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
})

const vector = new ConvexVector({
  id: 'agentforge-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
})
```

#### Required env vars
```
CONVEX_URL=https://your-project.convex.cloud
CONVEX_ADMIN_KEY=              # from Convex dashboard → Settings → Deploy Key
```

⚠️ **`CONVEX_ADMIN_KEY` is highly sensitive** — full admin access to the deployment. Never expose to clients. Only use server-side in the daemon.

### Limitations of ConvexStore
| Limitation | Workaround |
|------------|------------|
| **No observability domain** | Use composite storage to route traces to PostgreSQL/ClickHouse |
| **1 MiB max record size** | Upload base64 attachments to Convex file storage or S3/R2 first, store URL |

### Mastra Table Schema
Each table has:
- `id` field — Mastra's record ID (≠ Convex's auto-generated `_id`)
- `by_record_id` index — efficient lookup by Mastra ID

---

## 4. What NOT to Use: `@convex-dev/mastra`

`@convex-dev/mastra` is a different package — a Convex **component** for running Mastra **inside** Convex. We are NOT using it.

Reason: It runs Mastra workflows inside Node.js actions (cold starts every time). We use a persistent daemon instead.

For reference, it requires:
```typescript
storage.setCtx(ctx)   // must be called before use inside actions
vector.setCtx(ctx)
```
And it has a local dev incompatibility: needs Node 20 for `mastra dev` but Node 18 for `convex dev`.

Do not add `@convex-dev/mastra` to this project.

---

## 5. AgentForge Architecture (Central Daemon)

```
┌──────────────────────────────────────────────────────────┐
│  AgentForge Daemon  (packages/runtime — persistent)       │
│                                                           │
│  createStandardAgent()  ←  agents loaded from Convex     │
│  Memory: ConvexStore + ConvexVector                       │
│                                                           │
│  Channels:                                                │
│  ├── HTTP  → /v1/chat/completions (SSE streaming)         │
│  ├── Discord → progressive streaming, 1.5s edit interval  │
│  └── Telegram → grammy, streaming edits                   │
└───────────────┬──────────────────────────────────────────┘
                │  @mastra/convex (HTTP client)
                │  CONVEX_URL + CONVEX_ADMIN_KEY
┌───────────────▼──────────────────────────────────────────┐
│  Convex Backend  (data layer only — no LLM logic)         │
│                                                           │
│  mastra_*: threads, messages, resources, workflow_snapshots│
│  agents, apiKeys, files, settings, logs, usage, tokens    │
│                                                           │
│  Encryption: "use node" action + node:crypto AES-256-GCM  │
└───────────────┬──────────────────────────────────────────┘
                │ Convex real-time
┌───────────────▼──────────────────────────────────────────┐
│  Dashboard (React + Convex client)                        │
│  agents, threads, messages, logs — all real-time          │
└──────────────────────────────────────────────────────────┘
```

### What belongs where

| Logic | Lives in | Why |
|-------|----------|-----|
| LLM calls | `packages/runtime/` | Persistent process, streaming, no cold starts |
| Agent memory | ConvexStore via `@mastra/convex` | Real-time dashboard visibility |
| Agent config | Convex `agents` table | Config as data, reactive queries |
| API key encryption | Convex `"use node"` internalAction | node:crypto is fast; V8 crypto.subtle is slow |
| Real-time queries | Convex default V8 runtime | No cold starts, reactive |
| Dashboard | React + Convex client | Real-time, no custom server needed |

---

## 6. Encryption: AES-256-GCM in Convex Node.js Action

**Never use XOR. Never use crypto.subtle with PBKDF2 for high-frequency operations.**

```typescript
// convex/apiKeysCrypto.ts
"use node"
import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import * as crypto from 'node:crypto'

function deriveKey(salt: string): Buffer {
  return crypto.hkdfSync('sha256', Buffer.from(salt, 'utf8'), '', 'agentforge-api-key', 32)
}

export const encrypt = internalAction({
  args: { plaintext: v.string(), salt: v.string() },
  returns: v.object({ ciphertext: v.string(), iv: v.string(), tag: v.string() }),
  handler: async (_, { plaintext, salt }) => {
    const key = deriveKey(salt)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    }
  },
})

export const decrypt = internalAction({
  args: { ciphertext: v.string(), iv: v.string(), tag: v.string(), salt: v.string() },
  returns: v.string(),
  handler: async (_, { ciphertext, iv, tag, salt }) => {
    const key = deriveKey(salt)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return decipher.update(Buffer.from(ciphertext, 'base64')).toString() + decipher.final('utf8')
  },
})
```

**Why not `crypto.subtle` in V8 runtime:** HKDF + AES-GCM via `crypto.subtle` in Convex's V8 sandbox adds ~10-19s latency. Node.js native crypto is synchronous and instant. This confirmed the need for `"use node"` actions for crypto operations.

---

## 7. `createStandardAgent()` Pattern (from Koki's Chico)

```typescript
// packages/runtime/src/agent/create-standard-agent.ts
export interface StandardAgentConfig {
  id: string
  name: string
  description?: string
  instructions: string
  model?: string                    // defaults to DAEMON_MODEL
  tools?: ToolsInput
  workingMemoryTemplate?: string
  disableObservationalMemory?: boolean
}

export function createStandardAgent(config: StandardAgentConfig): Agent {
  const model = config.model ?? DAEMON_MODEL
  const memory = createStandardMemory({ workingMemoryTemplate: config.workingMemoryTemplate })
  return new Agent({
    id: config.id,
    name: config.name,
    description: config.description,
    model,
    memory,
    tools: config.tools ?? {},
    inputProcessors: [
      new UnicodeNormalizer({ stripControlChars: true, collapseWhitespace: true }),
      new TokenLimiterProcessor({ limit: getContextLimit(model), strategy: 'truncate', countMode: 'cumulative' }),
    ],
    instructions: config.instructions,
  })
}
```

```typescript
// packages/runtime/src/agent/shared.ts
export const DAEMON_MODEL = 'moonshotai/kimi-k2.5'
export const OBSERVER_MODEL = 'google/gemini-2.5-flash'
export const EMBEDDING_MODEL = 'google/gemini-embedding-001'

export function createStandardMemory(opts?: StandardMemoryOptions): Memory {
  return new Memory({
    storage,   // ConvexStore singleton (initialized at daemon startup)
    vector,    // ConvexVector singleton
    embedder: new ModelRouterEmbeddingModel(EMBEDDING_MODEL),
    options: { ... },
  })
}
```

---

## 8. Channel Adapter Pattern

```typescript
// packages/runtime/src/channels/types.ts
export interface ChannelAdapter {
  name: string
  start(agents: Map<string, Agent>, daemon: AgentForgeDaemon): Promise<void>
  stop(): Promise<void>
}
```

### Progressive Streaming (for chat channels)
```typescript
// Post "Thinking..." immediately, then edit every 1.5s as stream arrives
async function progressiveStream(
  agent: Agent,
  message: string,
  opts: { threadId?: string; resourceId?: string },
  onUpdate: (text: string, done: boolean) => Promise<void>
): Promise<void> {
  const stream = await agent.stream(message, opts)
  let buffer = ''
  let lastEdit = Date.now()
  const EDIT_INTERVAL = 1500

  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') {
      buffer += chunk.payload.text
      if (Date.now() - lastEdit > EDIT_INTERVAL) {
        await onUpdate(buffer, false)
        lastEdit = Date.now()
      }
    }
  }
  await onUpdate(buffer, true)  // final update
}
```

---

## 9. Template Sync — The 4-Location Problem

**Every template file edit must be synced to all 4 locations:**

| Location | Purpose |
|----------|---------|
| `packages/cli/templates/default/convex/` | **Canonical source** |
| `packages/cli/dist/default/convex/` | Built copy for npm |
| `templates/default/convex/` | Root copy |
| `convex/` | Local dev copy |

**Automate with:** `pnpm sync-templates` → runs `scripts/sync-templates.sh`

Failing to sync = regression for `agentforge create` users.

---

## 10. MCP Docs Server

The Mastra MCP docs server provides documentation, examples, blog posts, and changelogs directly to AI assistants:

```bash
# Use for IDE agents / coding assistants
npx @mastra/mcp-docs-server
```

Package: `@mastra/mcp-docs-server` (npmjs.com/package/@mastra/mcp-docs-server)

Configure in your IDE/agent to give coding assistants direct access to up-to-date Mastra docs.

---

## 11. Quick Reference Links

| Resource | URL |
|----------|-----|
| Convex docs hub | https://docs.convex.dev/home |
| Convex runtimes | https://docs.convex.dev/functions/runtimes |
| Convex best practices | https://docs.convex.dev/understanding/best-practices |
| Convex HTTP actions | https://docs.convex.dev/functions/http-actions |
| Mastra docs | https://mastra.ai/docs |
| Mastra agents | https://mastra.ai/docs/agents/overview |
| Mastra memory | https://mastra.ai/docs/memory/overview |
| Mastra workflows | https://mastra.ai/docs/workflows/overview |
| Mastra tools reference | https://mastra.ai/reference/tools/tool |
| @mastra/convex storage | https://mastra.ai/reference/storage/convex |
| @mastra/convex vectors | https://mastra.ai/reference/vectors/convex |
| get-convex/mastra repo | https://github.com/get-convex/mastra |
| Mastra model list | https://mastra.ai/models |
| Mastra MCP docs server | https://npmjs.com/package/@mastra/mcp-docs-server |
