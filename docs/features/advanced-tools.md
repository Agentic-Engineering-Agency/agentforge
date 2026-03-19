---
title: "Advanced MCP Tools"
description: "Advanced techniques for dynamic tool registration, Zod schema validation, and tool discovery with MCP servers."
---

# Advanced MCP Tools

AgentForge uses the Model-Context-Protocol (MCP) Server to provide tools to agents. This guide covers advanced techniques for creating and managing tools.

## Dynamic Tool Registration

Tools can be registered dynamically at runtime. This is useful for creating tools that depend on external services or user-specific configurations.

```typescript
import { MCPServer } from "@agentforge-ai/core";
import { z } from "zod";

const mcpServer = new MCPServer();

// A simple tool
mcpServer.registerTool({
  name: "getWeather",
  description: "Get the weather for a location",
  inputSchema: z.object({ location: z.string() }),
  outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
  handler: async ({ location }) => {
    // In a real implementation, call a weather API
    return { temperature: 72, condition: "Sunny" };
  },
});

// A tool that depends on a user-specific API key
async function createStripeTool(apiKey: string) {
  const stripe = await import("stripe").then((mod) => new mod.default(apiKey));

  mcpServer.registerTool({
    name: "createStripeCharge",
    description: "Create a charge in Stripe",
    inputSchema: z.object({ amount: z.number(), currency: z.string() }),
    outputSchema: z.object({ id: z.string(), status: z.string() }),
    handler: async ({ amount, currency }) => {
      const charge = await stripe.charges.create({ amount, currency, source: "tok_visa" });
      return { id: charge.id, status: charge.status };
    },
  });
}

// In your application startup, you would call this with the user's key
// createStripeTool(process.env.STRIPE_API_KEY);
```

## Zod Schemas for Complex I/O

Zod is used to define the input and output schemas for tools. This provides strong type safety and validation.

### Input Validation

Zod schemas automatically validate the input provided by the agent. If the input does not match the schema, the MCP server will throw an error.

### Output Shaping

The output of your tool's handler must match the `outputSchema`. The MCP server will validate this before returning the result to the agent.

### Example: File Upload Tool

```typescript
import { z } from "zod";

const fileUploadTool = {
  name: "uploadFile",
  description: "Upload a file to storage",
  inputSchema: z.object({
    fileName: z.string().describe("The name of the file"),
    content: z.instanceof(Buffer).describe("The file content as a Buffer"),
  }),
  outputSchema: z.object({
    url: z.string().url().describe("The public URL of the uploaded file"),
  }),
  handler: async ({ fileName, content }) => {
    // In a real implementation, upload to S3, R2, etc.
    const url = `https://storage.example.com/${fileName}`;
    return { url };
  },
};
```

## Tool Discovery

The MCP server exposes a `discover` method that returns a JSON schema of all registered tools. This is used by the agent to understand what tools are available and how to use them.

```typescript
const server = new MCPServer();
// ... register tools

const toolSchemas = server.discover();
console.log(JSON.stringify(toolSchemas, null, 2));
```

This will output a JSON array that can be passed to the `tools` parameter of an LLM, enabling function calling.
