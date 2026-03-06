import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const MAX_RESULTS = 20;
const FETCH_TIMEOUT_MS = 10_000;

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for current information.',
  inputSchema: z.object({
    query: z.string(),
    count: z.number().int().min(1).max(MAX_RESULTS).optional(),
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

    const clamped = count; // already enforced by Zod schema (.min(1).max(MAX_RESULTS))
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('count', String(clamped));
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        console.error(`[web-search] Error: HTTP ${response.status} ${response.statusText}`);
        return { results: [] };
      }
      const data = await response.json() as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
      const results = (data.web?.results ?? []).slice(0, clamped).map(r => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
      }));
      return { results };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[web-search] Error: request timed out after ${FETCH_TIMEOUT_MS}ms`);
      } else {
        console.error("[web-search] Error:", err instanceof Error ? err.message : String(err));
      }
      return { results: [] };
    } finally {
      clearTimeout(timer);
    }
  },
});
