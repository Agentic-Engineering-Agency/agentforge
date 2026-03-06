import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  splitMessage,
  formatSSEChunk,
  generateThreadId,
} from '../src/channels/shared.js';
import { HttpChannel } from '../src/channels/http.js';
import { AgentForgeDaemon } from '../src/daemon/daemon.js';
import { initStorage } from '../src/agent/shared.js';

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
      expect(chunks).toEqual([]);
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

});

describe('HTTP Channel Integration', () => {
  let daemon: AgentForgeDaemon;
  let channel: HttpChannel;
  const testPort = 3456; // Use non-conflicting port

  beforeAll(async () => {
    // Initialize storage with mock credentials for tests
    initStorage('https://mock.convex.cloud', 'mock-admin-key');
    // Set required API key for embedding model
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';

    // Create daemon with a test agent
    daemon = new AgentForgeDaemon();
    await daemon.loadAgents([
      {
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful test assistant. Keep responses brief.',
      },
    ]);

    // Create and start HTTP channel
    channel = new HttpChannel({ port: testPort, apiKey: 'test-key' });
    daemon.addChannel(channel);
    await channel.start(new Map(), daemon);

    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (channel) {
      await channel.stop();
    }
  });

  describe('GET /health', () => {
    it('returns 200 status', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`, {
        headers: { Authorization: 'Bearer test-key' },
      });
      expect(response.status).toBe(200);
    });

    it('returns correct structure with agents list', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`, {
        headers: { Authorization: 'Bearer test-key' },
      });
      const data = await response.json() as { status: string; version: string; agents: string[] };
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('agents');
      expect(Array.isArray(data.agents)).toBe(true);
      expect(data.agents).toContain('test-agent');
    });

    it('requires valid API key', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`, {
        headers: { Authorization: 'Bearer wrong-key' },
      });
      expect(response.status).toBe(401);
    });

    it('returns 401 without auth header', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /v1/agents', () => {
    it('returns list of loaded agents', async () => {
      const response = await fetch(`http://localhost:${testPort}/v1/agents`, {
        headers: { Authorization: 'Bearer test-key' },
      });
      const data = await response.json() as { object: string; data: Array<{ id: string; name: string }> };
      expect(data.object).toBe('list');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0]).toHaveProperty('id');
      expect(data.data[0]).toHaveProperty('name');
    });

    it('includes test-agent in list', async () => {
      const response = await fetch(`http://localhost:${testPort}/v1/agents`, {
        headers: { Authorization: 'Bearer test-key' },
      });
      const data = await response.json() as { data: Array<{ id: string }> };
      const testAgent = data.data.find((a: { id: string }) => a.id === 'test-agent');
      expect(testAgent).toBeDefined();
    });
  });

  describe('POST /v1/chat/completions', () => {
    it('returns error without model', async () => {
      const response = await fetch(`http://localhost:${testPort}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      });
      expect(response.status).toBe(400);
    });

    it('returns error for empty messages', async () => {
      const response = await fetch(`http://localhost:${testPort}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({ model: 'test-agent', messages: [] }),
      });
      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent agent', async () => {
      const response = await fetch(`http://localhost:${testPort}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({
          model: 'non-existent',
          messages: [{ role: 'user', content: 'hello' }],
          stream: false,
        }),
      });
      expect(response.status).toBe(404);
    });
  });
});

describe('Channel Shared Utilities Edge Cases', () => {
  describe('splitMessage edge cases', () => {
    it('handles single word longer than limit', () => {
      const text = 'a'.repeat(5000);
      const chunks = splitMessage(text, 200);
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(200);
      });
    });

    it('handles mixed content with code and text', () => {
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
  });

  describe('formatSSEChunk edge cases', () => {
    it('handles unicode content', () => {
      const chunk = formatSSEChunk('Hello 🌍 世界');
      expect(chunk).toContain('Hello');
      // Unicode may be escaped, which is fine
      expect(chunk.length).toBeGreaterThan(0);
    });
  });
});

