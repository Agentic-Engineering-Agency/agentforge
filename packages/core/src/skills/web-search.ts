/**
 * Web Search Skill
 *
 * Performs web searches using DuckDuckGo Instant Answer API.
 * Returns search results with snippets and URLs.
 */

import type { BundledSkill } from './types.js';

export const WebSearchSkill: BundledSkill = {
  name: 'web-search',
  description: 'Search the web for information using DuckDuckGo. Returns relevant results with snippets.',
  category: 'web',
  schema: {
    input: {
      query: { type: 'string', description: 'Search query', required: true },
      maxResults: { type: 'number', description: 'Maximum number of results (default: 5)', required: false },
    },
    output: 'Array of search results with title, url, and snippet',
  },
  execute: async (args) => {
    const query = args.query as string;
    const maxResults = (args.maxResults as number) ?? 5;

    if (!query || typeof query !== 'string') {
      return JSON.stringify({ error: 'Query is required and must be a string' });
    }

    try {
      // Use DuckDuckGo Instant Answer API
      const url = new URL('https://api.duckduckgo.com/');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AgentForge/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as {
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        AbstractText?: string;
        AbstractURL?: string;
        AbstractSource?: string;
      };

      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Add abstract if available
      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.AbstractSource || 'Summary',
          url: data.AbstractURL,
          snippet: data.AbstractText,
        });
      }

      // Add related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics) {
          if (results.length >= maxResults) break;
          if (topic.FirstURL && topic.Text) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Result',
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          }
        }
      }

      return JSON.stringify({
        query,
        results: results.length > 0 ? results : [{ title: 'No results', url: '', snippet: 'No results found' }],
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        query,
      });
    }
  },
};
