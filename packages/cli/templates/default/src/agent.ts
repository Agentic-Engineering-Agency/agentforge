import { Agent } from '@agentforge-ai/core';

/**
 * A sample AgentForge agent.
 *
 * This is a starting point for your own agent. Modify the instructions,
 * model, and tools to suit your needs.
 */
const myAgent = new Agent({
  id: 'my-first-agent',
  name: 'My First Agent',
  instructions: `You are a helpful AI assistant built with AgentForge.
You can help users with a variety of tasks.
Be concise, accurate, and friendly.`,
  model: 'openai:gpt-4o-mini',
});

export default myAgent;

// Example usage:
// const response = await myAgent.generate('Hello, what can you do?');
// console.log(response.text);
