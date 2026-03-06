import { describe, it, expect, beforeEach, vi } from 'vitest';
import { datetimeTool } from '../src/tools/datetime.js';
import { webSearchTool } from '../src/tools/web-search.js';
import { readUrlTool } from '../src/tools/read-url.js';
import { manageNotesTool } from '../src/tools/manage-notes.js';

describe('Tools', () => {
  describe('datetime tool', () => {
    it('returns object with datetime string', async () => {
      const result = await datetimeTool.execute({});
      expect(result).toHaveProperty('datetime');
      expect(typeof result.datetime).toBe('string');
      expect(result.datetime).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('returns object with timezone', async () => {
      const result = await datetimeTool.execute({ timezone: 'UTC' });
      expect(result).toHaveProperty('timezone');
      expect(result.timezone).toBe('UTC');
    });
  });

  describe('web-search tool', () => {
    beforeEach(() => {
      // Mock BRAVE_API_KEY
      process.env.BRAVE_API_KEY = 'test-key';
    });

    it('returns object with results array when API key is set', async () => {
      // Mock fetch to avoid real API calls
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ web: { results: [] } }),
      });
      global.fetch = mockFetch as any;

      const result = await webSearchTool.execute({ query: 'test query', count: 5 });
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);

      // Verify query and count are passed as URL params
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.get('q')).toBe('test query');
      expect(url.searchParams.get('count')).toBe('5');
    });

    it('returns message when API key not set', async () => {
      delete process.env.BRAVE_API_KEY;
      const result = await webSearchTool.execute({ query: 'test' });
      expect(result).toHaveProperty('results');
      expect(result.results).toEqual([]);
    });
  });

  describe('read-url tool', () => {
    it('extracts title and content from example.com', async () => {
      // Mock fetch to return example.com HTML
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `<!DOCTYPE html><html><head><title>Example Domain</title></head><body><h1>Example Domain</h1><p>This domain is for use in illustrative examples.</p></body></html>`,
      }) as any;

      const result = await readUrlTool.execute({ url: 'https://example.com' });
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('excerpt');
      expect(typeof result.title).toBe('string');
      expect(typeof result.content).toBe('string');
    });
  });

  describe('manage-notes tool', () => {
    beforeEach(() => {
      // Clear notes before each test
      vi.resetModules();
    });

    it('create returns success: true', async () => {
      const result = await manageNotesTool.execute({
        action: 'create',
        title: 'test note',
        content: 'hello world',
      });
      expect(result.success).toBe(true);
    });

    it('list returns notes array', async () => {
      const result = await manageNotesTool.execute({ action: 'list' });
      expect(result).toHaveProperty('notes');
      expect(Array.isArray(result.notes)).toBe(true);
    });

    it('read returns note when id provided', async () => {
      const createResult = await manageNotesTool.execute({
        action: 'create',
        title: 'test note',
        content: 'hello world',
      });
      expect(createResult.success).toBe(true);
      if (createResult.note?.id) {
        const readResult = await manageNotesTool.execute({
          action: 'read',
          id: createResult.note.id,
        });
        expect(readResult).toHaveProperty('note');
      }
    });
  });
});
