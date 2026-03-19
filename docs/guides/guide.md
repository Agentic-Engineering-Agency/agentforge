---
title: "Usage Guide"
description: "Core concepts and a step-by-step tutorial for building your first AI agent with AgentForge."
---

# AgentForge Usage Guide

Welcome to the AgentForge framework! This guide will walk you through the core concepts and provide a step-by-step tutorial for building your first AI agent.

## Core Concepts

The AgentForge framework is built on three core pillars:

1.  **Agents**: The central actors in the system. An `Agent` is a TypeScript class that encapsulates a large language model (LLM), system instructions, and a set of tools. It provides a simple API for generating responses and streaming output.

2.  **Tools**: Functions that agents can call to interact with the outside world. Tools are defined with Zod schemas for type-safe inputs and outputs, and they run in a secure E2B sandbox to prevent malicious code execution.

3.  **State**: The memory and context of your agents. AgentForge uses Convex as its backend for real-time data, allowing agents to persist conversations, manage state, and even collaborate with each other.

## Getting Started: Your First Agent

Let's build a simple "Hello, World!" agent.

### 1. Create a New Project

First, use the CLI to create a new project:

```bash
npm install -g @agentforge-ai/cli
agentforge create hello-agent
cd hello-agent
```

### 2. Define Your Agent

Open `src/agent.ts`. This is where you define your agent's identity and capabilities. Let's create a simple greeter agent.

```typescript
// src/agent.ts
import { Agent } from '@agentforge-ai/core';
import { openai } from '@ai-sdk/openai';

const greeterAgent = new Agent({
  id: 'greeter',
  name: 'Greeter Agent',
  instructions: 'You are a friendly agent that greets people. Be warm and welcoming.',
  model: openai('gpt-4o-mini'), // or any other AI SDK model
});

export default greeterAgent;
```

### 3. Interact with Your Agent

Now, let's create a script to interact with our agent. Create a new file `src/run.ts`:

```typescript
// src/run.ts
import greeterAgent from './agent.js';

async function main() {
  console.log('Sending a message to the greeter agent...');
  const response = await greeterAgent.generate('Hello!');
  console.log('Agent Response:', response.text);
}

main();
```

### 4. Run Your Agent

Before running, make sure you have your `OPENAI_API_KEY` set in a `.env` file.

Then, you can run your script using `tsx` (you may need to install it: `npm install -g tsx`):

```bash
tsx src/run.ts
```

You should see your agent's friendly greeting in the console!

## Next Steps

This is just the beginning. From here, you can:

*   **Add Tools**: Create tools for your agent to fetch data, send emails, or perform any other action.
*   **Use Convex**: Store conversation history, manage user profiles, and build collaborative agent workflows.
*   **Deploy**: Deploy your Convex backend with `npx convex deploy`.

Check out the **FinForge** demo in the `/examples` directory for a more advanced, real-world use case.
