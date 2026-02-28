/**
 * URL Fetch Skill
 *
 * Fetches and extracts text content from a URL.
 * Handles HTML, plain text, and JSON responses.
 */

import type { BundledSkill } from './types.js';

export const UrlFetchSkill: BundledSkill = {
  name: 'url-fetch',
  description: 'Fetch and extract text content from a URL. Supports HTML, text, and JSON.',
  category: 'io',
  schema: {
    input: {
      url: { type: 'string', description: 'URL to fetch', required: true },
      maxLength: { type: 'number', description: 'Maximum characters to return (default: 10000)', required: false },
    },
    output: 'Extracted text content or error message',
  },
  execute: async (args) => {
    const url = args.url as string;
    const maxLength = (args.maxLength as number) ?? 10000;

    if (!url || typeof url !== 'string') {
      return JSON.stringify({ error: 'URL is required and must be a string' });
    }

    try {
      // Validate URL format
      new URL(url);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AgentForge/1.0',
          'Accept': 'text/html,text/plain,application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let text = await response.text();

      // Truncate if too long
      if (text.length > maxLength) {
        text = text.slice(0, maxLength) + '\n\n... (truncated)';
      }

      // Basic HTML stripping
      if (contentType.includes('html')) {
        text = text
          .replace(/<script[^>]*>.*?<\/script>/gis, '')
          .replace(/<style[^>]*>.*?<\/style>/gis, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      return JSON.stringify({
        url,
        status: response.status,
        contentType,
        length: text.length,
        content: text,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        url,
      });
    }
  },
};
