import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
]);

function isPrivateHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  // IPv4 private/loopback ranges
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some(o => o > 255)) return false; // malformed — not a valid IP, don't block
    const [firstOctet, secondOctet] = octets;
    if (firstOctet === 127) return true;                                   // 127.0.0.0/8 loopback
    if (firstOctet === 10) return true;                                    // 10.0.0.0/8 private
    if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) return true; // 172.16.0.0/12 private
    if (firstOctet === 192 && secondOctet === 168) return true;            // 192.168.0.0/16 private
    if (firstOctet === 169 && secondOctet === 254) return true;            // 169.254.0.0/16 link-local
  }
  return false;
}

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
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Unsupported protocol: ${parsed.protocol}`);
      }
      if (isPrivateHost(parsed.hostname)) {
        throw new Error(`Access to private/internal addresses is not allowed`);
      }
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
