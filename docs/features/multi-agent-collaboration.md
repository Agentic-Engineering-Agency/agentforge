---
title: "Multi-Agent Collaboration"
description: "Patterns for building multi-agent systems including coordinator-worker, shared state, and message bus architectures."
---

# Multi-Agent Collaboration

AgentForge is designed for building both single agents and complex multi-agent systems. This guide explores patterns for enabling collaboration between agents.

## The Coordinator-Worker Pattern

The most common multi-agent pattern is the **Coordinator-Worker** (or Master-Slave) pattern. In this model, a central **Coordinator** agent is responsible for breaking down a complex task into smaller sub-tasks and distributing them to specialized **Worker** agents.

### Example: Research and Reporting

Imagine building a system to write a research report on a given topic.

- **Coordinator Agent**: Receives the topic (e.g., "The future of AI in healthcare"). Its job is to create a plan:
  1.  Search for recent academic papers.
  2.  Search for news articles and market reports.
  3.  Summarize the findings from both sources.
  4.  Write a final report.

- **Worker Agents**:
  - `ResearchAgent`: Specialized in using search tools to find information.
  - `SummarizerAgent`: Specialized in summarizing long texts.
  - `WriterAgent`: Specialized in composing well-structured reports.

### Implementation in AgentForge

```typescript
import { Agent } from "@agentforge-ai/core";
import { openai } from "@ai-sdk/openai";

// Define the worker agents
const researchAgent = new Agent({
  id: "researcher",
  name: "Research Agent",
  instructions: "You are an expert researcher. Find relevant information on a topic.",
  model: openai("gpt-4o-mini"),
  tools: { /* search tools */ },
});

const summarizerAgent = new Agent({
  id: "summarizer",
  name: "Summarizer Agent",
  instructions: "You are an expert summarizer. Condense the provided text.",
  model: openai("gpt-4o-mini"),
});

// Define the coordinator agent
const coordinator = new Agent({
  id: "coordinator",
  name: "Coordinator Agent",
  instructions: "You are a project manager. Create a plan and delegate tasks to your team.",
  model: openai("gpt-4o"), // Use a more powerful model for planning
  tools: {
    // The coordinator's tools are the other agents
    runResearch: async (topic: string) => researchAgent.generate(topic),
    runSummarize: async (text: string) => summarizerAgent.generate(text),
  },
});

async function main() {
  const topic = "The future of AI in healthcare";
  const finalReport = await coordinator.generate(`Create a research report on: ${topic}`);
  console.log(finalReport.text);
}

main();
```

## Agent Communication

Agents can communicate in several ways:

1.  **Direct Tool Calls (as above)**: The Coordinator directly invokes the `generate` method of worker agents, which are exposed as tools.

2.  **Shared State (Convex)**: Agents can communicate asynchronously by reading and writing to a shared database. For example, the `ResearchAgent` could write its findings to a `documents` table in Convex, and the `SummarizerAgent` could read from that table.

3.  **Message Bus (Advanced)**: For more complex systems, a message bus (like Redis Pub/Sub or RabbitMQ) can be used to broadcast messages between agents.

## Key Considerations

- **Model Selection**: Use more powerful and expensive models (like GPT-4o) for coordinator agents that require strong reasoning and planning capabilities. Use smaller, faster models (like GPT-4o-mini) for specialized worker agents.

- **Tool Design**: Design tools to be modular and composable. An agent itself can be a tool for another agent.

- **State Management**: For long-running tasks, use a persistent state store like Convex to track progress and handle failures.
