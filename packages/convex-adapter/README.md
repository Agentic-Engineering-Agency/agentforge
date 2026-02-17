# @agentforge-ai/convex-adapter

> Bridge between @agentforge-ai/core and the Convex backend

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## Overview

`@agentforge-ai/convex-adapter` provides Convex-aware wrappers for the core AgentForge primitives, enabling AI agents to run inside Convex actions with full access to the Convex backend.

### Key Features

- **ConvexAgent** — Run @agentforge-ai/core agents inside Convex actions
- **ConvexMCPServer** — MCP tool registry with Convex persistence
- **ConvexVault** — AES-256-GCM encrypted secrets management

## Installation

```bash
pnpm add @agentforge-ai/convex-adapter @agentforge-ai/core convex
```

## Quick Start

### ConvexAgent

Wraps the core Agent for use in Convex actions:

```typescript
import { ConvexAgent } from "@agentforge-ai/convex-adapter";
import { openai } from "@ai-sdk/openai";
import { action } from "./_generated/server";
import { v } from "convex/values";

export const chat = action({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    const agent = new ConvexAgent(
      {
        id: "assistant",
        name: "My Assistant",
        instructions: "You are a helpful assistant.",
        model: openai("gpt-4o-mini"),
      },
      ctx
    );

    const response = await agent.generate(args.prompt);
    return response.text;
  },
});
```

#### Creating from a Database Record

```typescript
import { ConvexAgent } from "@agentforge-ai/convex-adapter";

// In an action handler:
const agentRecord = await ctx.runQuery(api.agents.get, { id: "my-agent" });
const agent = ConvexAgent.fromRecord(agentRecord, ctx);
const response = await agent.generate("Hello!");
```

#### Streaming Responses

```typescript
for await (const chunk of agent.stream("Tell me a story")) {
  // Send chunk to client
  console.log(chunk.content);
}
```

#### With Tools

```typescript
import { ConvexAgent, ConvexMCPServer } from "@agentforge-ai/convex-adapter";
import { z } from "zod";

const tools = new ConvexMCPServer(ctx);
tools.registerTool({
  name: "get_weather",
  description: "Get current weather for a city",
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.string(),
  handler: async ({ city }) => `Weather in ${city}: 72°F, sunny`,
});

const agent = new ConvexAgent(config, ctx);
agent.addTools(tools);
```

### ConvexMCPServer

MCP tool registry with optional Convex persistence:

```typescript
import { ConvexMCPServer } from "@agentforge-ai/convex-adapter";

const server = new ConvexMCPServer(ctx, {
  name: "my-tools",
  persistMutation: api.skills.create, // Optional: persist to Convex
  loadQuery: api.skills.list, // Optional: load from Convex
});

// Register a tool
server.registerTool({
  name: "calculate",
  description: "Perform arithmetic",
  inputSchema: z.object({ expression: z.string() }),
  outputSchema: z.number(),
  handler: async ({ expression }) => eval(expression),
});

// Persist tool metadata to Convex
const tool = server.listTools()[0];
await server.persistTool(tool);

// Load previously persisted tools
const savedTools = await server.loadPersistedTools();
```

### ConvexVault

AES-256-GCM encrypted secrets management:

```typescript
import { ConvexVault } from "@agentforge-ai/convex-adapter";

// Standalone encryption
const vault = new ConvexVault({ encryptionKey: "my-secret-passphrase" });

// Encrypt/decrypt directly
const encrypted = vault.encrypt("sk-my-api-key");
const decrypted = vault.decrypt(
  encrypted.ciphertext,
  encrypted.iv,
  encrypted.authTag
);

// Key-value store (in-memory)
await vault.set("openai-key", "sk-abc123...");
const key = await vault.get("openai-key"); // "sk-abc123..."

// With Convex persistence (in a mutation)
vault.setContext(ctx); // Pass MutationCtx
await vault.set("anthropic-key", "sk-ant-...");
const anthropicKey = await vault.get("anthropic-key");
```

#### Secret Operations

```typescript
// Check if secret exists
const exists = await vault.has("openai-key"); // true

// List all secrets (masked values only)
const secrets = await vault.list();
// [{ key: "openai-key", maskedValue: "sk-abc...23..." }]

// Delete a secret
await vault.delete("openai-key");

// Get count
console.log(vault.size); // 0
```

## API Reference

### ConvexAgent

| Method | Description |
| --- | --- |
| `constructor(config, ctx)` | Create a new ConvexAgent |
| `generate(prompt)` | Generate a response |
| `stream(prompt)` | Stream a response |
| `addTools(server)` | Add tools from an MCPServer |
| `clearTools()` | Remove all tools |
| `getTools()` | List all tool schemas |
| `callTool(name, input)` | Invoke a specific tool |
| `runQuery(query, args)` | Execute a Convex query |
| `runMutation(mutation, args)` | Execute a Convex mutation |
| `static fromRecord(record, ctx)` | Create from a stored agent record |

### ConvexMCPServer

| Method | Description |
| --- | --- |
| `constructor(ctx, config?)` | Create with Convex context |
| `registerTool(tool)` | Register a tool (in-memory) |
| `persistTool(toolSchema)` | Persist tool metadata to Convex |
| `loadPersistedTools()` | Load persisted tool records |
| `isToolPersisted(name)` | Check if tool is persisted |
| `unpersistTool(name)` | Remove from persistence cache |
| `listTools()` | List all registered tools |
| `callTool(name, input)` | Invoke a tool |

### ConvexVault

| Method | Description |
| --- | --- |
| `constructor(config?)` | Create vault (reads VAULT_ENCRYPTION_KEY env) |
| `setContext(ctx)` | Set Convex MutationCtx for persistence |
| `encrypt(value)` | Encrypt a string (returns ciphertext, iv, authTag) |
| `decrypt(ciphertext, iv, authTag)` | Decrypt a string |
| `set(key, value)` | Store an encrypted secret |
| `get(key)` | Retrieve and decrypt a secret |
| `delete(key)` | Delete a secret |
| `list()` | List all secrets (masked values) |
| `has(key)` | Check if secret exists |
| `size` | Number of stored secrets |

## Configuration

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `VAULT_ENCRYPTION_KEY` | Encryption passphrase for ConvexVault | Built-in default (NOT for production) |

## License

Apache-2.0 — see [LICENSE](../../LICENSE) for details.
