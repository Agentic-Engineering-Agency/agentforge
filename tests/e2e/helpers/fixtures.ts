/**
 * E2E Test Fixtures
 *
 * Reusable agent configurations, prompts, and expected responses
 * for the E2E test suite. All IDs are deterministic for reproducibility.
 */

import { z } from 'zod';

// ─── Agent Fixtures ─────────────────────────────────────────────────────────

export const FIXTURES = {
  agents: {
    /** Basic assistant — no tools, no frills */
    basic: {
      id: 'basic-assistant',
      name: 'E2E Basic Assistant',
      description: 'A minimal agent for E2E testing',
      instructions: 'You are a helpful assistant. Answer questions concisely.',
      model: 'gpt-4o-mini',
      provider: 'openai',
    },

    /** Agent with tools */
    withTools: {
      id: 'tools-agent',
      name: 'E2E Tools Agent',
      description: 'Agent with MCP tools for E2E testing',
      instructions:
        'You are an assistant with tools. Use the calculator tool when asked to compute.',
      model: 'gpt-4o-mini',
      provider: 'openai',
    },

    /** Agent for thread/conversation tests */
    conversational: {
      id: 'convo-agent',
      name: 'E2E Conversational Agent',
      description: 'Agent for multi-turn conversation tests',
      instructions:
        'You are a conversational assistant. Remember the context of the conversation. ' +
        'When asked about previous messages, refer to them accurately.',
      model: 'gpt-4o-mini',
      provider: 'openai',
    },

    /** Agent for deploy tests — minimal config */
    deployable: {
      id: 'deploy-test',
      name: 'E2E Deploy Agent',
      description: 'Agent used to test deployment flow',
      instructions: 'You are a test agent for deployment verification.',
      model: 'gpt-4o-mini',
      provider: 'openai',
    },
  },

  prompts: {
    /** Deterministic math — verifiable without LLM */
    math: 'What is 2 + 2? Answer with just the number.',
    /** Something that requires memory */
    nameIntro: 'My name is AgentForge Test User. Remember that.',
    /** Follow-up that depends on context */
    nameRecall: 'What is my name?',
    /** Tool-triggering prompt */
    calculate: 'Use the calculator tool to compute 15 * 7.',
    /** Longer form */
    explain: 'Explain what AgentForge is in one sentence.',
  },

  tools: {
    calculator: {
      name: 'calculator',
      description: 'Performs basic arithmetic operations',
      inputSchema: z.object({
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
        a: z.number(),
        b: z.number(),
      }),
      outputSchema: z.object({
        result: z.number(),
      }),
      handler: async (input: { operation: string; a: number; b: number }) => {
        switch (input.operation) {
          case 'add':
            return { result: input.a + input.b };
          case 'subtract':
            return { result: input.a - input.b };
          case 'multiply':
            return { result: input.a * input.b };
          case 'divide':
            if (input.b === 0) throw new Error('Division by zero');
            return { result: input.a / input.b };
          default:
            throw new Error(`Unknown operation: ${input.operation}`);
        }
      },
    },

    echo: {
      name: 'echo',
      description: 'Echoes the input back — useful for testing tool plumbing',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        echoed: z.string(),
      }),
      handler: async (input: { message: string }) => ({
        echoed: input.message,
      }),
    },
  },
} as const;

// ─── Helper: Create unique test IDs ────────────────────────────────────────

let counter = 0;

export function uniqueTestId(prefix: string): string {
  counter++;
  return `${prefix}-${Date.now()}-${counter}`;
}

/**
 * Resets the counter — useful between test suites.
 */
export function resetTestIdCounter(): void {
  counter = 0;
}
