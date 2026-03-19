---
title: "Agent-to-Agent (A2A) Protocol"
description: "Inter-agent communication with task delegation, streaming results, and multi-agent orchestration patterns."
---

# Agent-to-Agent (A2A) Protocol

AgentForge implements the A2A protocol for inter-agent communication. Agents can discover each other, delegate tasks, and stream results — enabling multi-agent systems where specialized agents collaborate on complex work.

## Concepts

- **A2A Client** — Sends tasks to other agents
- **A2A Server** — Receives and executes delegated tasks
- **A2A Registry** — Maps agent IDs to endpoints for discovery
- **A2A Task** — A unit of work delegated from one agent to another

## Setting Up the Registry

The registry allows agents to discover each other by ID:

```typescript
import { A2AAgentRegistry } from '@agentforge-ai/core';

const registry = new A2AAgentRegistry();

// Register agents with their endpoints
registry.register('research-agent', 'https://research.example.com/a2a');
registry.register('coding-agent', 'https://coding.example.com/a2a');
registry.register('review-agent', 'https://review.example.com/a2a');
```

## Delegating Tasks

Use the A2A client to send work to another agent:

```typescript
import { A2AClient } from '@agentforge-ai/core';

const client = new A2AClient(registry);

// Delegate a task
const result = await client.delegate({
  from: 'coordinator',
  to: 'research-agent',
  instruction: 'Find the top 5 TypeScript testing frameworks and compare their features.',
  context: {
    messages: previousConversation,
    metadata: { priority: 'high' },
  },
  constraints: {
    maxTokens: 4000,
    timeoutMs: 30000,
  },
});

if (result.status === 'success') {
  console.log('Research complete:', result.output);
  console.log('Duration:', result.durationMs, 'ms');
  console.log('Tokens used:', result.usage);
}
```

### Streaming delegation

For long-running tasks, use streaming to get partial results:

```typescript
const stream = client.delegateStream({
  from: 'coordinator',
  to: 'coding-agent',
  instruction: 'Implement a binary search function in TypeScript with tests.',
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## Handling Tasks (A2A Server)

Set up an agent to receive delegated tasks:

```typescript
import { A2AServer } from '@agentforge-ai/core';

const server = new A2AServer(myAgent, {
  requireAuth: true,
  allowedAgents: ['coordinator', 'review-agent'],  // Whitelist
  maxInstructionLength: 10000,
});

// Create an HTTP handler for incoming tasks
const handler = server.createHandler();

// Use with your HTTP framework (Express, Hono, etc.)
app.post('/a2a', handler);
```

### Whitelist security

The `allowedAgents` configuration restricts which agents can send tasks. If an unlisted agent tries to delegate, the request is rejected.

### Authentication

When `requireAuth` is `true`, the server checks for a `Bearer` token in the `Authorization` header.

## Task Structure

### A2A Task

```typescript
interface A2ATask {
  id: string;              // Unique task ID
  from: string;            // Sender agent ID
  to: string;              // Receiver agent ID
  instruction: string;     // What to do (max 10,000 chars)
  context?: {
    messages?: Message[];  // Conversation history
    memory?: any;          // Shared memory
    metadata?: Record<string, any>;
  };
  constraints?: {
    maxTokens?: number;    // Token budget
    timeoutMs?: number;    // Timeout in milliseconds
    maxCost?: number;      // Cost budget
  };
  callbackUrl?: string;    // URL for async result delivery
  createdAt: Date;
}
```

### A2A Result

```typescript
interface A2AResult {
  taskId: string;
  status: 'success' | 'error' | 'timeout';
  output?: string;         // Task output
  artifacts?: any[];       // Additional data (files, structured output)
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  durationMs: number;
}
```

## Multi-Agent Patterns

### Coordinator-Worker

A coordinator agent breaks down complex tasks and delegates to specialized workers:

```typescript
const coordinator = new Agent({
  name: 'coordinator',
  model: 'anthropic/claude-sonnet-4-20250514',
  instructions: `You coordinate complex tasks by delegating to specialized agents:
    - research-agent: for information gathering
    - coding-agent: for code generation
    - review-agent: for code review`,
});

const client = new A2AClient(registry);

// In the coordinator's tool handler:
const researchResult = await client.delegate({
  from: 'coordinator',
  to: 'research-agent',
  instruction: 'Research best practices for WebSocket authentication.',
});

const codeResult = await client.delegate({
  from: 'coordinator',
  to: 'coding-agent',
  instruction: `Implement WebSocket auth based on this research: ${researchResult.output}`,
});

const reviewResult = await client.delegate({
  from: 'coordinator',
  to: 'review-agent',
  instruction: `Review this implementation for security issues: ${codeResult.output}`,
});
```

### Swarm Orchestration

For parallel execution across multiple agents, use the SwarmOrchestrator:

```typescript
import { SwarmOrchestrator } from '@agentforge-ai/core';

const swarm = new SwarmOrchestrator({
  agents: [researchAgent, codingAgent, reviewAgent],
  resourceLimits: 'PRO',  // DEFAULT, PRO, or ENTERPRISE tiers
});

const results = await swarm.execute({
  tasks: [
    { agent: 'research-agent', instruction: 'Research WebSocket auth' },
    { agent: 'coding-agent', instruction: 'Write connection pooling' },
  ],
});
```

The swarm handles parallel execution, partial failure recovery, and result aggregation.
