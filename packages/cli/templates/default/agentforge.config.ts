/**
 * Example AgentForge Configuration File
 * 
 * This file defines your agents and their configurations.
 * The CLI uses this to deploy to AgentForge Cloud.
 */

export default {
  name: 'my-agent-project',
  version: '1.0.0',
  
  agents: [
    {
      id: 'support-agent',
      name: 'Customer Support Agent',
      model: 'gpt-4o',
      instructions: `You are a helpful customer support agent.
        
Be polite, professional, and try to resolve customer issues quickly.
If you don't know the answer, escalate to a human agent.`,
      tools: [
        {
          name: 'searchKnowledgeBase',
          description: 'Search the knowledge base for articles',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        },
        {
          name: 'createTicket',
          description: 'Create a support ticket',
          parameters: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
            required: ['subject', 'description'],
          },
        },
      ],
    },
    {
      id: 'code-assistant',
      name: 'Code Assistant',
      model: 'anthropic/claude-3-opus',
      instructions: `You are an expert programming assistant.
        
Help users write clean, efficient, and well-documented code.
Explain your reasoning and provide examples when helpful.`,
      tools: [
        {
          name: 'runCode',
          description: 'Execute code in a sandboxed environment',
          parameters: {
            type: 'object',
            properties: {
              language: { type: 'string', enum: ['javascript', 'python', 'typescript'] },
              code: { type: 'string' },
            },
            required: ['language', 'code'],
          },
        },
      ],
    },
  ],
  
  // Sandbox configuration for agent tool execution isolation
  sandbox: {
    // Provider: 'local' (default), 'docker', 'e2b', or 'none'
    provider: 'local',
    // Docker-specific options (only used when provider is 'docker')
    docker: {
      image: 'node:22-slim',
      resourceLimits: {
        memoryMb: 512,
        cpuShares: 512,
        networkDisabled: false,
        pidsLimit: 256,
      },
      // Timeout in seconds before auto-killing the container
      timeout: 300,
    },
  },

  // Optional: Environment variables available to all agents
  env: {
    SUPPORT_EMAIL: 'support@example.com',
    COMPANY_NAME: 'Acme Inc',
  },
};
