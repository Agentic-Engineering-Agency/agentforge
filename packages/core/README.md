# @agentforge/core

Core agent primitives, secure sandbox execution, and MCP server for the AgentForge framework.

## Installation

```bash
npm install @agentforge/core
```

## Quick Start

```typescript
import { Agent, SandboxManager, MCPServer } from '@agentforge/core';

// Create an agent
const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-4o-mini',
});

// Generate a response
const response = await agent.generate('Hello, world!');

// Execute code securely
const sandbox = new SandboxManager({ timeout: 10000 });
const result = await sandbox.runCode('console.log("Hello from sandbox!")');

// Register tools with MCP
const mcp = new MCPServer();
mcp.registerTool({
  name: 'calculator',
  inputSchema: z.object({ expression: z.string() }),
  outputSchema: z.string(),
  handler: async ({ expression }) => eval(expression).toString(),
});
```

## API Reference

### Agent

The core agent class wrapping Mastra for AI orchestration.

- `new Agent(config)` - Create a new agent
- `agent.generate(prompt)` - Generate a response
- `agent.stream(prompt)` - Stream a response

### SandboxManager

Secure code execution via E2B sandboxes.

- `new SandboxManager(config)` - Create a sandbox manager
- `manager.runCode(code, options)` - Execute code securely
- `manager.cleanup()` - Clean up resources

### MCPServer

Model Context Protocol server for tool communication.

- `new MCPServer()` - Create an MCP server
- `server.registerTool(tool)` - Register a tool
- `server.listTools()` - List all tools
- `server.callTool(name, input)` - Call a tool

## License

Apache-2.0
