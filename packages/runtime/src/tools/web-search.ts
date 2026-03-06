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
  }),
  execute: async ({ query, count = 5 }) => {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      console.error("[web-search] Error: BRAVE_API_KEY is not set");
      return { results: [] };
    }

    try {
      const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('count', String(count));
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      });
      if (!response.ok) {
        console.error(`[web-search] Error: HTTP ${response.status} ${response.statusText}`);
        return { results: [] };
      }
      const data = await response.json();
      const results = (data.web?.results || []).slice(0, count).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.description || '',
      }));
      return { results };
    } catch (err) {
      console.error("[web-search] Error:", err instanceof Error ? err.message : String(err));
      return { results: [] };
    }
  },
});
