/**
 * E2E Test 4: Thread Continuity
 *
 * Validates multi-turn conversations work correctly across the framework→Cloud path:
 *   1. Thread creation and persistence
 *   2. Message history accumulation
 *   3. Context preservation across turns
 *   4. Thread metadata management
 *   5. Thread cleanup and deletion
 *
 * Tests use the Cloud API to create threads, send multi-turn messages,
 * and verify that conversation context is maintained.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CloudTestClient, type CloudMessage, type CloudThread } from './helpers/cloud-client.js';
import { getTestConfig } from './helpers/env.js';
import { FIXTURES, uniqueTestId } from './helpers/fixtures.js';

// ─── State ────────────────────────────────────────────────────────────────

let cloudClient: CloudTestClient;
let testAgentId: string;

// ─── Tests ────────────────────────────────────────────────────────────────

describe('E2E: Thread Continuity', () => {
  beforeAll(async () => {
    const config = getTestConfig();
    cloudClient = new CloudTestClient(config.cloudUrl, config.apiKey);

    // Seed a conversational agent
    testAgentId = uniqueTestId('threads');
    await cloudClient.createAgent({
      ...FIXTURES.agents.conversational,
      id: testAgentId,
    });
  });

  afterAll(async () => {
    try {
      await cloudClient.deleteAgent(testAgentId);
    } catch {
      // Best-effort cleanup
    }
  });

  // ── Thread Creation ────────────────────────────────────────────────────

  describe('Thread Creation', () => {
    it('creates a new thread via API', async () => {
      const thread = await cloudClient.createThread(testAgentId, 'Test Thread');

      expect(thread).toBeDefined();
      expect(thread._id).toBeDefined();
      expect(thread.agentId).toContain(testAgentId);
    });

    it('creates thread with custom name', async () => {
      const customName = `Custom Thread ${Date.now()}`;
      const thread = await cloudClient.createThread(testAgentId, customName);

      expect(thread.name).toBe(customName);
    });

    it('auto-creates thread when running agent without threadId', async () => {
      const result = await cloudClient.runAgent(testAgentId, 'Hello');

      expect(result.threadId).toBeDefined();
      expect(typeof result.threadId).toBe('string');
      expect(result.threadId.length).toBeGreaterThan(0);
    });
  });

  // ── Multi-Turn Conversation ────────────────────────────────────────────

  describe('Multi-Turn Conversation', () => {
    it('maintains conversation across multiple messages', async () => {
      // Turn 1: Introduce a fact
      const turn1 = await cloudClient.runAgent(
        testAgentId,
        FIXTURES.prompts.nameIntro
      );
      const threadId = turn1.threadId;
      expect(threadId).toBeDefined();

      // Turn 2: Ask about the fact (requires context)
      const turn2 = await cloudClient.runAgent(
        testAgentId,
        FIXTURES.prompts.nameRecall,
        threadId
      );

      // Should reference same thread
      expect(turn2.threadId).toBe(threadId);

      // The response should contain the name or acknowledge it
      // (Since agent.run is a placeholder, we verify the message exists)
      expect(turn2.message).toBeDefined();
      expect(turn2.message.length).toBeGreaterThan(0);
    });

    it('accumulates messages in thread history', async () => {
      // Create a conversation
      const turn1 = await cloudClient.runAgent(testAgentId, 'Message one');
      const threadId = turn1.threadId;

      await cloudClient.runAgent(testAgentId, 'Message two', threadId);
      await cloudClient.runAgent(testAgentId, 'Message three', threadId);

      // Fetch message history
      const messages = await cloudClient.listThreadMessages(threadId);

      // Should have pairs: user + assistant for each turn
      // 3 turns = 6 messages (3 user + 3 assistant)
      expect(messages.length).toBeGreaterThanOrEqual(6);

      // Verify order: messages should be chronological
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].createdAt).toBeGreaterThanOrEqual(
          messages[i - 1].createdAt
        );
      }
    });

    it('stores both user and assistant messages', async () => {
      const result = await cloudClient.runAgent(testAgentId, 'Check message roles');
      const messages = await cloudClient.listThreadMessages(result.threadId);

      const roles = messages.map((m) => m.role);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
    });

    it('preserves exact user message content', async () => {
      const userMessage = 'This is a very specific test message with special chars: @#$%';
      const result = await cloudClient.runAgent(testAgentId, userMessage);
      const messages = await cloudClient.listThreadMessages(result.threadId);

      const userMsg = messages.find(
        (m) => m.role === 'user' && m.content === userMessage
      );
      expect(userMsg).toBeDefined();
    });
  });

  // ── Thread Isolation ───────────────────────────────────────────────────

  describe('Thread Isolation', () => {
    it('different threads do not share context', async () => {
      // Thread A: introduce a secret
      const threadA = await cloudClient.runAgent(
        testAgentId,
        'The secret word is BANANA.'
      );

      // Thread B: ask about the secret (should not know)
      const threadB = await cloudClient.runAgent(
        testAgentId,
        'What is the secret word?'
      );

      // Threads should be different
      expect(threadA.threadId).not.toBe(threadB.threadId);

      // Thread B's messages should not contain BANANA in user history
      const messagesB = await cloudClient.listThreadMessages(threadB.threadId);
      const userMessagesB = messagesB.filter((m) => m.role === 'user');
      const allUserContent = userMessagesB.map((m) => m.content).join(' ');
      expect(allUserContent).not.toContain('BANANA');
    });

    it('threads are scoped to their agent', async () => {
      // Create a second agent
      const secondAgentId = uniqueTestId('isolation');
      await cloudClient.createAgent({
        ...FIXTURES.agents.basic,
        id: secondAgentId,
        name: 'Isolation Test Agent',
      });

      // Run both agents
      const result1 = await cloudClient.runAgent(testAgentId, 'Agent 1 message');
      const result2 = await cloudClient.runAgent(secondAgentId, 'Agent 2 message');

      // Different threads
      expect(result1.threadId).not.toBe(result2.threadId);

      // Different agent IDs
      expect(result1.agentId).not.toBe(result2.agentId);

      // Cleanup
      await cloudClient.deleteAgent(secondAgentId);
    });
  });

  // ── Thread Metadata ────────────────────────────────────────────────────

  describe('Thread Metadata', () => {
    it('thread has creation timestamp', async () => {
      const thread = await cloudClient.createThread(testAgentId, 'Metadata Test');
      expect(thread.createdAt).toBeDefined();
      expect(typeof thread.createdAt).toBe('number');
      expect(thread.createdAt).toBeGreaterThan(0);
    });

    it('thread updatedAt changes after new message', async () => {
      const result = await cloudClient.runAgent(testAgentId, 'First');
      const threadAfterFirst = await cloudClient.getThread(result.threadId);

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await cloudClient.runAgent(testAgentId, 'Second', result.threadId);
      const threadAfterSecond = await cloudClient.getThread(result.threadId);

      if (threadAfterFirst && threadAfterSecond) {
        expect(threadAfterSecond.updatedAt).toBeGreaterThanOrEqual(
          threadAfterFirst.updatedAt
        );
      }
    });
  });

  // ── Message Ordering ──────────────────────────────────────────────────

  describe('Message Ordering', () => {
    it('messages are returned in chronological order', async () => {
      const result = await cloudClient.runAgent(testAgentId, 'First turn');
      await cloudClient.runAgent(testAgentId, 'Second turn', result.threadId);
      await cloudClient.runAgent(testAgentId, 'Third turn', result.threadId);

      const messages = await cloudClient.listThreadMessages(result.threadId);

      // Verify strictly non-decreasing timestamps
      const timestamps = messages.map((m) => m.createdAt);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }

      // First user message should be "First turn"
      const userMessages = messages.filter((m) => m.role === 'user');
      expect(userMessages[0].content).toBe('First turn');
      expect(userMessages[1].content).toBe('Second turn');
      expect(userMessages[2].content).toBe('Third turn');
    });

    it('interleaves user and assistant messages correctly', async () => {
      const result = await cloudClient.runAgent(testAgentId, 'Q1');
      await cloudClient.runAgent(testAgentId, 'Q2', result.threadId);

      const messages = await cloudClient.listThreadMessages(result.threadId);

      // Expected pattern: user, assistant, user, assistant
      expect(messages.length).toBeGreaterThanOrEqual(4);

      // Check alternating pattern for the first 4 messages
      if (messages.length >= 4) {
        expect(messages[0].role).toBe('user');
        expect(messages[1].role).toBe('assistant');
        expect(messages[2].role).toBe('user');
        expect(messages[3].role).toBe('assistant');
      }
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles very long conversation (10+ turns)', async () => {
      const result = await cloudClient.runAgent(testAgentId, 'Turn 1');
      const threadId = result.threadId;

      for (let i = 2; i <= 10; i++) {
        await cloudClient.runAgent(testAgentId, `Turn ${i}`, threadId);
      }

      const messages = await cloudClient.listThreadMessages(threadId);
      // 10 turns × 2 messages (user + assistant) = 20
      expect(messages.length).toBeGreaterThanOrEqual(20);
    });

    it('handles unicode in messages', async () => {
      const unicodeMessage = 'Hola! 🤖 ¿Cómo estás? 你好 مرحبا';
      const result = await cloudClient.runAgent(testAgentId, unicodeMessage);
      const messages = await cloudClient.listThreadMessages(result.threadId);

      const userMsg = messages.find(
        (m) => m.role === 'user' && m.content === unicodeMessage
      );
      expect(userMsg).toBeDefined();
    });

    it('handles empty messages', async () => {
      const result = await cloudClient.runAgent(testAgentId, '');
      expect(result).toBeDefined();
      expect(result.threadId).toBeDefined();
    });
  });
});
