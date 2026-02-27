/**
 * Context Window Management Tests (AGE-158 + AGE-177)
 *
 * Tests for context management strategies:
 * - truncation: messages over token limit dropped oldest-first
 * - sliding: sliding window — drop oldest when over limit
 * - summarize: compress oldest messages via cheap model at 80% of limit
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_TOKEN_LIMIT,
  countTokens,
  applySliding,
  applyTruncate,
  shouldSummarize,
  type ContextStrategy,
  type Message,
} from './lib/context';

describe('Token Counting', () => {
  it('countTokens approximates 4 chars per token', () => {
    expect(countTokens('')).toBe(0);
    expect(countTokens('abcd')).toBe(1);
    expect(countTokens('abcdefgh')).toBe(2);
    expect(countTokens('hello world')).toBe(3);
  });

  it('countTokens handles multi-byte characters', () => {
    expect(countTokens('hello 世界')).toBe(2); // 8 chars / 4 = 2
  });

  it('countTokens rounds up for partial tokens', () => {
    expect(countTokens('abc')).toBe(1);
    expect(countTokens('a')).toBe(1);
  });
});

describe('Sliding Window Strategy', () => {
  it('returns all messages when under limit', () => {
    const messages: Message[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    const result = applySliding(messages, 100);
    expect(result).toEqual(messages);
  });

  it('drops oldest messages when over limit', () => {
    const messages: Message[] = [
      { role: 'user', content: 'a'.repeat(100) },
      { role: 'assistant', content: 'b'.repeat(100) },
      { role: 'user', content: 'c'.repeat(100) },
    ];
    const limit = 50; // Only 50 chars ≈ 12-13 tokens
    const result = applySliding(messages, limit);
    // Should drop oldest messages to fit under limit
    const totalTokens = result.reduce((sum, m) => sum + countTokens(m.content), 0);
    expect(totalTokens).toBeLessThanOrEqual(limit);
  });

  it('always keeps most recent message if possible', () => {
    const messages: Message[] = [
      { role: 'user', content: 'old message ' + 'x'.repeat(1000) },
      { role: 'user', content: 'new' },
    ];
    const result = applySliding(messages, 10);
    expect(result[result.length - 1].content).toBe('new');
  });

  it('handles empty message array', () => {
    const result = applySliding([], 100);
    expect(result).toEqual([]);
  });
});

describe('Truncate Strategy', () => {
  it('returns all messages when under limit', () => {
    const messages: Message[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    const result = applyTruncate(messages, 100);
    expect(result).toEqual(messages);
  });

  it('drops oldest-first when over limit', () => {
    const messages: Message[] = [
      { role: 'user', content: 'first ' + 'x'.repeat(100) },
      { role: 'assistant', content: 'second ' + 'y'.repeat(100) },
      { role: 'user', content: 'third' },
    ];
    const limit = 30;
    const result = applyTruncate(messages, limit);
    const totalTokens = result.reduce((sum, m) => sum + countTokens(m.content), 0);
    expect(totalTokens).toBeLessThanOrEqual(limit);
  });

  it('handles empty message array', () => {
    const result = applyTruncate([], 100);
    expect(result).toEqual([]);
  });
});

describe('Summarize Strategy Detection', () => {
  it('returns true when tokens exceed 80% of limit', () => {
    const messages: Message[] = [
      { role: 'user', content: 'x'.repeat(84) }, // ~21 tokens, limit 25, 80% = 20
    ];
    expect(shouldSummarize(messages, 25)).toBe(true);
  });

  it('returns false when tokens under 80% of limit', () => {
    const messages: Message[] = [
      { role: 'user', content: 'x'.repeat(40) }, // ~10 tokens, limit 25, 80% = 20
    ];
    expect(shouldSummarize(messages, 25)).toBe(false);
  });

  it('returns false for empty messages', () => {
    expect(shouldSummarize([], 100)).toBe(false);
  });
});

describe('Context Strategy Type', () => {
  it('valid strategy values', () => {
    const strategies: ContextStrategy[] = ['sliding', 'truncate', 'summarize'];
    strategies.forEach((s) => {
      expect(['sliding', 'truncate', 'summarize']).toContain(s);
    });
  });
});

describe('DEFAULT_TOKEN_LIMIT', () => {
  it('is 8000 tokens', () => {
    expect(DEFAULT_TOKEN_LIMIT).toBe(8000);
  });
});

describe('Edge Cases', () => {
  it('handles very long single message', () => {
    const messages: Message[] = [
      { role: 'user', content: 'x'.repeat(10000) },
    ];
    const result = applySliding(messages, 100);
    // Even a single message over limit should be truncated to fit
    const totalTokens = result.reduce((sum, m) => sum + countTokens(m.content), 0);
    expect(totalTokens).toBeLessThanOrEqual(100);
  });

  it('preserves message order', () => {
    const messages: Message[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
      { role: 'assistant', content: 'fourth' },
    ];
    const result = applySliding(messages, 5);
    // Order should be preserved
    for (let i = 1; i < result.length; i++) {
      const idx = messages.findIndex((m) => m.content === result[i].content);
      const prevIdx = messages.findIndex((m) => m.content === result[i - 1].content);
      expect(idx).toBeGreaterThan(prevIdx);
    }
  });

  it('handles zero token limit gracefully', () => {
    const messages: Message[] = [
      { role: 'user', content: 'hello' },
    ];
    const result = applySliding(messages, 0);
    expect(result).toEqual([]);
  });
});

describe('Real-world Scenarios', () => {
  it('sliding window keeps recent conversation context', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Let me tell you a story ' + 'x'.repeat(2000) },
      { role: 'assistant', content: 'That is interesting! ' + 'y'.repeat(2000) },
      { role: 'user', content: 'What is 2+2?' },
    ];
    const result = applySliding(messages, 1000);
    // Recent question should be preserved
    expect(result.some((m) => m.content.includes('2+2'))).toBe(true);
  });

  it('truncate strategy drops older messages first', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful ' + 'z'.repeat(500) },
      { role: 'user', content: 'Hello ' + 'a'.repeat(500) },
      { role: 'assistant', content: 'Hi ' + 'b'.repeat(500) },
      { role: 'user', content: 'Bye' },
    ];
    const result = applyTruncate(messages, 200);
    const totalTokens = result.reduce((sum, m) => sum + countTokens(m.content), 0);
    expect(totalTokens).toBeLessThanOrEqual(200);
    // Last message should be kept
    expect(result[result.length - 1].content).toBe('Bye');
  });
});
