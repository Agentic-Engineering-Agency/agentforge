import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const BRAVE_MAX_QUERY_LENGTH = 400;

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for current information.',
  inputSchema: z.object({
    query: z.string().max(BRAVE_MAX_QUERY_LENGTH),
    count: z.number().optional(),
  }),
  outputSchema: z.object({
    results: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })),
  }),
  execute: async ({ query, count = 5 }) => {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      return { results: [] };
    }

    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(count));
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      });
      if (!response.ok) {
        return { results: [] };
      }
      const data = await response.json();
      const results = (data.web?.results || []).slice(0, count).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.description || '',
      }));
      return { results };
    } catch {
      return { results: [] };
    }
  },
});
