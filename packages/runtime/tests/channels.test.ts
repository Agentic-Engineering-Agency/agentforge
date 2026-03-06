import { describe, it, expect, vi } from 'vitest';
import {
  splitMessage,
  formatSSEChunk,
  generateThreadId,
  progressiveStream,
} from '../src/channels/shared.js';

describe('Channel Shared Utilities', () => {
  describe('splitMessage', () => {
    it('splits long message into chunks within limit', () => {
      const longText = 'A'.repeat(5000);
      const chunks = splitMessage(longText, 2000);
      expect(chunks.length).toBe(3);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      });
    });

    it('handles messages with code blocks', () => {
      const text = 'Before code\n```typescript\nconst x = "code";\n```\nAfter code';
      const chunks = splitMessage(text, 100);
      // Each chunk should be within the limit
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(100);
      });
    });

    it('handles text with many newlines', () => {
      const text = 'Line 1\nLine 2\nLine 3\n'.repeat(100);
      const chunks = splitMessage(text, 200);
      // Each chunk should be within the limit
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(200);
      });
      // Should have multiple chunks for long text
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('handles empty string', () => {
      const chunks = splitMessage('', 2000);
      // Returns one empty chunk so callers always have a safe chunks[0]
      expect(chunks).toEqual(['']);
    });

    it('handles text shorter than limit', () => {
      const text = 'Short text';
      const chunks = splitMessage(text, 2000);
      expect(chunks).toEqual(['Short text']);
    });

    it('handles Discord limit (2000 chars)', () => {
      const text = 'A'.repeat(5000);
      const chunks = splitMessage(text, 2000);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      });
    });

    it('handles Telegram limit (4096 chars)', () => {
      const text = 'B'.repeat(10000);
      const chunks = splitMessage(text, 4096);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      });
    });

    it('trims trailing newlines from chunks', () => {
      const text = 'Line 1\nLine 2\nLine 3\n';
      const chunks = splitMessage(text, 100);
      chunks.forEach(chunk => {
        expect(chunk).not.toMatch(/\n$/);
      });
    });
  });

  describe('formatSSEChunk', () => {
    it('formats text chunk correctly', () => {
      const chunk = formatSSEChunk('Hello world');
      expect(chunk).toMatch(/^data: /);
      expect(chunk).toContain('"choices"');
      expect(chunk).toContain('"delta"');
      expect(chunk).toContain('"content":"Hello world"');
      expect(chunk).toMatch(/}\n\n$/);
    });

    it('includes finish_reason when provided', () => {
      const chunk = formatSSEChunk('Done', 'stop');
      expect(chunk).toContain('"finish_reason":"stop"');
    });

    it('sets null finish_reason when streaming', () => {
      const chunk = formatSSEChunk('Streaming', null);
      expect(chunk).toContain('"finish_reason":null');
    });

    it('includes required OpenAI fields', () => {
      const chunk = formatSSEChunk('test');
      expect(chunk).toContain('"id":');
      expect(chunk).toContain('"object":"chat.completion.chunk"');
      expect(chunk).toContain('"created":');
      expect(chunk).toContain('"model":"agentforge"');
    });

    it('handles empty content', () => {
      const chunk = formatSSEChunk('');
      expect(chunk).toContain('"content":""');
    });

    it('handles special characters in content', () => {
      const chunk = formatSSEChunk('Hello "world" \n new line');
      // JSON.stringify escapes quotes and newlines
      expect(chunk).toContain('Hello');
      expect(chunk).toContain('world');
      expect(chunk).toMatch(/"content"/);
    });
  });

  describe('generateThreadId', () => {
    it('generates thread ID in correct format', () => {
      const threadId = generateThreadId('discord', 'user123');
      expect(threadId).toBe('discord:user123');
    });

    it('handles telegram channel', () => {
      const threadId = generateThreadId('telegram', 'chat456');
      expect(threadId).toBe('telegram:chat456');
    });

    it('handles http channel', () => {
      const threadId = generateThreadId('http', 'session789');
      expect(threadId).toBe('http:session789');
    });

    it('preserves userId structure', () => {
      const threadId = generateThreadId('discord', '123456789');
      expect(threadId).toContain('123456789');
    });
  });

  describe('edge cases', () => {
    it('splitMessage handles single word longer than limit', () => {
      const text = 'a'.repeat(5000);
      const chunks = splitMessage(text, 200);
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(200);
      });
    });

    it('splitMessage handles mixed content with code and text', () => {
      const text = 'Regular text\n```typescript\nconst code = "here";\n```\nMore text\n```typescript\nconst more = "code";\n```\nFinal text';
      const chunks = splitMessage(text, 100);
      // All code blocks should be intact
      const codeBlocks = text.match(/```[\s\S]*?```/g);
      expect(codeBlocks).toBeDefined();
      codeBlocks?.forEach(block => {
        const found = chunks.some(chunk => chunk.includes(block));
        expect(found).toBe(true);
      });
    });

    it('formatSSEChunk handles unicode content', () => {
      const chunk = formatSSEChunk('Hello 🌍 世界');
      expect(chunk).toContain('Hello');
      // Unicode may be escaped, which is fine
      expect(chunk.length).toBeGreaterThan(0);
    });
  });

  // Helper to build a minimal mock Mastra Agent
  function makeMockStreamingAgent(textChunks: string[]): Parameters<typeof progressiveStream>[0] {
    return {
      stream: async () => ({
        fullStream: (async function* () {
          for (const t of textChunks) {
            yield { type: 'text-delta', payload: { text: t } };
          }
        })(),
      }),
    } as unknown as Parameters<typeof progressiveStream>[0];
  }

  describe('progressiveStream', () => {
    it('calls onChunk(text, true) at the end with accumulated text', async () => {
      const agent = makeMockStreamingAgent(['Hello', ', ', 'world']);
      const calls: Array<[string, boolean]> = [];
      const result = await progressiveStream(agent, 'hi', {}, async (t, done) => {
        calls.push([t, done]);
      });
      expect(result).toBe('Hello, world');
      // Last call must be (fullText, true)
      const last = calls[calls.length - 1];
      expect(last[0]).toBe('Hello, world');
      expect(last[1]).toBe(true);
    });

    it('respects custom editIntervalMs — does not call intermediate onChunk when under interval', async () => {
      // With a very long interval, intermediate calls should not happen
      const agent = makeMockStreamingAgent(['a', 'b', 'c']);
      let intermediateCalls = 0;
      await progressiveStream(
        agent,
        'hi',
        {},
        async (_text, done) => { if (!done) intermediateCalls++; },
        60_000, // 60 second interval — nothing should fire in a sync test
      );
      expect(intermediateCalls).toBe(0);
    });

    it('calls onChunk(buffer, true) on stream error so caller gets partial content', async () => {
      const agent = {
        stream: async () => ({
          fullStream: (async function* () {
            yield { type: 'text-delta', payload: { text: 'partial' } };
            throw new Error('network blip');
          })(),
        }),
      } as unknown as Parameters<typeof progressiveStream>[0];

      const calls: Array<[string, boolean]> = [];
      await expect(
        progressiveStream(agent, 'hi', {}, async (t, done) => { calls.push([t, done]); }),
      ).rejects.toThrow('network blip');

      // The error recovery callback must have done=true so the caller can finalise the message
      const errorRecoveryCall = calls.find(([, done]) => done);
      expect(errorRecoveryCall).toBeDefined();
      expect(errorRecoveryCall![0]).toBe('partial');
    });
  });
});
