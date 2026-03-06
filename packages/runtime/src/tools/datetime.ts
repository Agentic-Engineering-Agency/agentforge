import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const datetimeTool = createTool({
  id: 'get-current-datetime',
  description: 'Get the current date and time.',
  inputSchema: z.object({
    timezone: z.string().optional(),
  }),
  outputSchema: z.object({
    datetime: z.string(),
    timezone: z.string(),
  }),
  execute: async ({ timezone }) => {
    const now = new Date();
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      datetime: now.toISOString(),
      timezone: tz,
    };
  },
});
