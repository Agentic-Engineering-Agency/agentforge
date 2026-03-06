import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export const readUrlTool = createTool({
  id: 'read-url',
  description: 'Read and extract text content from a URL.',
  inputSchema: z.object({
    url: z.string(),
  }),
  outputSchema: z.object({
    title: z.string(),
    content: z.string(),
    excerpt: z.string(),
  }),
  execute: async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentForge/1.0)',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article) {
        // Fallback: extract text from body
        const bodyText = document.body?.textContent || '';
        const title = document.title || url;
        return {
          title,
          content: bodyText.trim().slice(0, 10000),
          excerpt: bodyText.trim().slice(0, 500),
        };
      }

      return {
        title: article.title || document.title || url,
        content: article.textContent || '',
        excerpt: article.excerpt || '',
      };
    } catch (error) {
      throw new Error(`Failed to read URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
