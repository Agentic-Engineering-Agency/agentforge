import { describe, it, expect } from 'vitest';
import {
  splitMessage,
  formatSSEChunk,
  generateThreadId,
} from '../src/channels/shared.js';
import { SlackChannelConfigSchema } from '../src/channels/slack.js';

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
});

describe('SlackChannelConfigSchema', () => {
  const validConfig = {
    defaultAgentId: 'my-agent',
    botToken: 'xoxb-123456789-abcdefghij',
    signingSecret: 'abc123signingsecret',
  };

  it('accepts valid config', () => {
    expect(() => SlackChannelConfigSchema.parse(validConfig)).not.toThrow();
  });

  it('rejects botToken without xoxb- prefix', () => {
    expect(() =>
      SlackChannelConfigSchema.parse({ ...validConfig, botToken: 'invalid-token' }),
    ).toThrow(/xoxb-/);
  });

  it('rejects botToken with wrong prefix (xoxp-)', () => {
    expect(() =>
      SlackChannelConfigSchema.parse({ ...validConfig, botToken: 'xoxp-user-token' }),
    ).toThrow(/xoxb-/);
  });

  it('rejects appToken without xapp- prefix when provided', () => {
    expect(() =>
      SlackChannelConfigSchema.parse({ ...validConfig, appToken: 'xoxb-wrong-prefix' }),
    ).toThrow(/xapp-/);
  });

  it('accepts valid appToken with xapp- prefix', () => {
    expect(() =>
      SlackChannelConfigSchema.parse({ ...validConfig, appToken: 'xapp-1-token' }),
    ).not.toThrow();
  });

  it('rejects missing signingSecret', () => {
    const { signingSecret: _, ...rest } = validConfig;
    expect(() => SlackChannelConfigSchema.parse(rest)).toThrow(/required/i);
  });

  it('rejects empty signingSecret', () => {
    expect(() =>
      SlackChannelConfigSchema.parse({ ...validConfig, signingSecret: '' }),
    ).toThrow(/required/i);
  });

  it('rejects missing defaultAgentId', () => {
    const { defaultAgentId: _, ...rest } = validConfig;
    expect(() => SlackChannelConfigSchema.parse(rest)).toThrow();
  });

  it('accepts editIntervalMs within range', () => {
    expect(() =>
      SlackChannelConfigSchema.parse({ ...validConfig, editIntervalMs: 2000 }),
    ).not.toThrow();
  });

  it('rejects editIntervalMs below minimum (< 100)', () => {
    expect(() =>
      SlackChannelConfigSchema.parse({ ...validConfig, editIntervalMs: 50 }),
    ).toThrow();
  });

  it('accepts optional allowedChannelIds', () => {
    expect(() =>
      SlackChannelConfigSchema.parse({ ...validConfig, allowedChannelIds: ['C123', 'C456'] }),
    ).not.toThrow();
  });
});
