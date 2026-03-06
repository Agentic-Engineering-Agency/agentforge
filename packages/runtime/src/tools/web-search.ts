import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for current information.',
  inputSchema: z.object({
    query: z.string(),
    count: z.number().optional(),
  }),
  outputSchema: z.object({
    results: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })),
    error: z.string().optional(),
  }),
  execute: async ({ query, count = 5 }) => {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      return { results: [], error: 'BRAVE_API_KEY is not set' };
    }

    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      });
      if (!response.ok) {
        return { results: [], error: `Brave Search API error: ${response.status} ${response.statusText}` };
      }
      const data = await response.json();
      const results = (data.web?.results || []).slice(0, count).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.description || '',
      }));
      return { results };
    } catch (err) {
      return { results: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },
});
