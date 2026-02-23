# MCP Integration

AgentForge has native support for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — both as a client (connecting to external MCP servers) and as a server (exposing tools to other systems).

## What is MCP?

MCP is an open protocol for connecting AI models to external tools, data sources, and services. It standardizes how tools are discovered, described, and invoked — so you can plug any MCP-compatible server into your agent.

## Connecting to an External MCP Server

### Via CLI

```bash
agentforge mcp connect <url>
```

This registers the MCP server connection in your Convex backend. The agent can then use tools from that server.

### Via code

```typescript
import { MCPClient } from '@agentforge-ai/core';

const client = new MCPClient({
  transport: {
    type: 'sse',
    url: 'https://mcp-server.example.com/sse',
  },
});

// List available tools
const tools = await client.listTools();

// Execute a tool
const result = await client.executeTool('search', {
  query: 'AgentForge documentation',
});
```

## Supported Transports

| Transport | Use case | Config |
|-----------|----------|--------|
| **stdio** | Local MCP servers (spawned as child process) | `{ type: 'stdio', command: 'node', args: ['server.js'] }` |
| **HTTP** | Remote MCP servers over HTTP | `{ type: 'http', url: 'https://...' }` |
| **SSE** | Remote MCP servers with Server-Sent Events | `{ type: 'sse', url: 'https://...' }` |

### stdio transport

For local MCP servers that run as a subprocess:

```typescript
const client = new MCPClient({
  transport: {
    type: 'stdio',
    command: 'node',
    args: ['./my-mcp-server.js'],
  },
});
```

### HTTP transport

For remote servers with request/response communication:

```typescript
const client = new MCPClient({
  transport: {
    type: 'http',
    url: 'https://mcp-server.example.com',
  },
});
```

### SSE transport

For remote servers with streaming support:

```typescript
const client = new MCPClient({
  transport: {
    type: 'sse',
    url: 'https://mcp-server.example.com/sse',
  },
});
```

## Dynamic Tool Loading

The `MCPDynamicToolLoader` converts MCP tools into Mastra-compatible tools at runtime. This means you can connect to any MCP server and its tools become available to your agent immediately.

```typescript
import { MCPClient, MCPDynamicToolLoader } from '@agentforge-ai/core';

const client = new MCPClient({
  transport: { type: 'sse', url: 'https://mcp-server.example.com/sse' },
});

const loader = new MCPDynamicToolLoader();

// Load all tools from the MCP server
const tools = await loader.loadTools(client);
// tools is an array of Mastra-compatible tools

// Watch for tool changes (polls every 30s by default)
loader.watchTools(client, (updatedTools) => {
  console.log('Tools updated:', updatedTools.map(t => t.name));
}, 30000);
```

The loader handles JSON Schema to Zod conversion automatically, so MCP tool schemas work with Mastra's Zod-based tool system.

## Building an MCP Server

Expose your agent's capabilities as an MCP server so other systems can use them:

```typescript
import { MCPServer } from '@agentforge-ai/core';
import { z } from 'zod';

const server = new MCPServer({
  name: 'my-tools',
  version: '1.0.0',
});

// Register a tool with a Zod schema
server.registerTool({
  name: 'search-docs',
  description: 'Search the documentation',
  schema: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().default(10).describe('Max results'),
  }),
  handler: async (input) => {
    const results = await searchDocumentation(input.query, input.limit);
    return { results };
  },
});

// Register another tool
server.registerTool({
  name: 'get-agent-status',
  description: 'Get the status of an agent',
  schema: z.object({
    agentId: z.string().describe('Agent ID'),
  }),
  handler: async (input) => {
    const status = await getAgentStatus(input.agentId);
    return status;
  },
});
```

### Adding MCP tools to an agent

```typescript
import { Agent, MCPServer } from '@agentforge-ai/core';

const agent = new Agent({
  name: 'my-agent',
  model: 'openai/gpt-4o',
  instructions: 'You are a helpful assistant with search capabilities.',
});

// Attach MCP server tools to the agent
agent.addTools(server);

// The agent can now use 'search-docs' and 'get-agent-status'
```

## MCP Connections in Convex

MCP connections are stored in the `mcpConnections` table in Convex. This means:

- Connections persist across agent restarts
- Multiple agents can share the same MCP server
- Connections are project-scoped (multi-tenancy)

Manage connections via CLI:

```bash
# List connections
agentforge mcp

# Connect a new server
agentforge mcp connect https://mcp-server.example.com/sse

# Remove a connection
agentforge mcp disconnect <connection-id>
```

## Tool Introspection

Both the MCP client and server support tool discovery:

```typescript
// Client: list tools from a remote server
const tools = await client.listTools();
for (const tool of tools) {
  console.log(`${tool.name}: ${tool.description}`);
  console.log('  Input schema:', JSON.stringify(tool.inputSchema));
}

// Client: list resources
const resources = await client.listResources();

// Client: list prompts
const prompts = await client.listPrompts();
```

```typescript
// Agent: list all registered tools (including MCP tools)
const tools = agent.getTools();

// Agent: call a specific tool
const result = await agent.callTool('search-docs', { query: 'setup guide' });
```
