import { z } from 'zod';

/**
 * browser-automation — Built-in AgentForge Skill
 *
 * Provides browser automation capabilities for agents using Playwright.
 * Supports navigation, interaction, text extraction, screenshots, and more.
 *
 * This skill wraps the @agentforge-ai/core browser tool for use in the
 * skills system. For direct programmatic access, use:
 *
 *   import { createBrowserTool } from '@agentforge-ai/core/browser';
 */

export const tools = [
  {
    name: 'browser',
    description:
      'Interact with web pages using browser automation. ' +
      'Supports: navigate, click, type, screenshot, snapshot (accessibility tree), ' +
      'evaluate JS, wait, scroll, select, hover, goBack, goForward, reload, close, extractText. ' +
      'Each session has isolated cookies and state.',
    inputSchema: z.object({
      action: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('navigate'), url: z.string().url() }),
        z.object({ kind: z.literal('click'), selector: z.string() }),
        z.object({
          kind: z.literal('type'),
          selector: z.string(),
          text: z.string(),
        }),
        z.object({
          kind: z.literal('screenshot'),
          fullPage: z.boolean().optional(),
        }),
        z.object({ kind: z.literal('snapshot') }),
        z.object({ kind: z.literal('evaluate'), js: z.string() }),
        z.object({
          kind: z.literal('wait'),
          selector: z.string().optional(),
          timeMs: z.number().optional(),
        }),
        z.object({
          kind: z.literal('scroll'),
          direction: z.enum(['up', 'down']),
          amount: z.number().optional(),
        }),
        z.object({
          kind: z.literal('select'),
          selector: z.string(),
          value: z.string(),
        }),
        z.object({ kind: z.literal('hover'), selector: z.string() }),
        z.object({ kind: z.literal('goBack') }),
        z.object({ kind: z.literal('goForward') }),
        z.object({ kind: z.literal('reload') }),
        z.object({ kind: z.literal('close') }),
        z.object({
          kind: z.literal('extractText'),
          selector: z.string().optional(),
        }),
      ]),
      sessionId: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      action: z.string(),
      data: z.union([z.string(), z.record(z.unknown())]).optional(),
      screenshot: z.string().optional(),
      error: z.string().optional(),
      currentUrl: z.string().optional(),
      pageTitle: z.string().optional(),
      latencyMs: z.number(),
    }),
    handler: async (input: {
      action: { kind: string; [key: string]: unknown };
      sessionId?: string;
    }) => {
      // Dynamic import to avoid requiring Playwright at skill load time
      const { createBrowserTool } = await import('@agentforge-ai/core');
      const { tool, shutdown } = createBrowserTool({ headless: true });

      try {
        const result = await tool.handler(input as any);
        return result;
      } finally {
        await shutdown();
      }
    },
  },
];

export default { tools };
