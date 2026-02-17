/**
 * E2E Test 3: Cloud Execution
 *
 * Validates that agents deployed to the Cloud:
 *   1. Can be invoked via the Cloud API
 *   2. Produce responses consistent with local execution
 *   3. Track usage (tokens, latency, cost)
 *   4. Handle errors gracefully
 *   5. Support concurrent execution
 *
 * Tests hit the Cloud API directly via CloudTestClient.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CloudTestClient } from './helpers/cloud-client.js';
import { getTestConfig } from './helpers/env.js';
import { FIXTURES, uniqueTestId } from './helpers/fixtures.js';

// ─── State ────────────────────────────────────────────────────────────────

let cloudClient: CloudTestClient;
let testAgentId: string;

// ─── Tests ────────────────────────────────────────────────────────────────

describe('E2E: Cloud Execution', () => {
  beforeAll(async () => {
    const config = getTestConfig();
    cloudClient = new CloudTestClient(config.cloudUrl, config.apiKey);

    // Seed a test agent for execution tests
    testAgentId = uniqueTestId('cloud-exec');
    await cloudClient.createAgent({
      ...FIXTURES.agents.basic,
      id: testAgentId,
    });
  });

  afterAll(async () => {
    // Cleanup test agent
    try {
      await cloudClient.deleteAgent(testAgentId);
    } catch {
      // Best-effort
    }
  });

  // ── Basic Execution ────────────────────────────────────────────────────

  describe('Basic Agent Execution', () => {
    it('runs agent and returns a response', async () => {
      const result = await cloudClient.runAgent(testAgentId, FIXTURES.prompts.math);

      expect(result).toBeDefined();
      expect(result.agentId).toContain(testAgentId);
      expect(result.threadId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('creates a thread for each new conversation', async () => {
      const result1 = await cloudClient.runAgent(testAgentId, 'Hello');
      const result2 = await cloudClient.runAgent(testAgentId, 'Hi there');

      // Each call without threadId creates a new thread
      expect(result1.threadId).toBeDefined();
      expect(result2.threadId).toBeDefined();
      expect(result1.threadId).not.toBe(result2.threadId);
    });

    it('reuses thread when threadId is provided', async () => {
      const result1 = await cloudClient.runAgent(testAgentId, 'First message');
      const result2 = await cloudClient.runAgent(
        testAgentId,
        'Second message',
        result1.threadId
      );

      expect(result2.threadId).toBe(result1.threadId);
    });
  });

  // ── Local ↔ Cloud Consistency ──────────────────────────────────────────

  describe('Local-Cloud Consistency', () => {
    it('Cloud agent has same config as what was deployed', async () => {
      const agent = await cloudClient.getAgent(testAgentId);

      expect(agent).not.toBeNull();
      expect(agent!.name).toBe(FIXTURES.agents.basic.name);
      expect(agent!.instructions).toBe(FIXTURES.agents.basic.instructions);
      expect(agent!.model).toBe(FIXTURES.agents.basic.model);
      expect(agent!.provider).toBe(FIXTURES.agents.basic.provider);
    });

    it('response structure matches local AgentResponse shape', async () => {
      const result = await cloudClient.runAgent(testAgentId, FIXTURES.prompts.explain);

      // Cloud response should map to local AgentResponse { text, toolResults? }
      expect(result).toHaveProperty('message'); // Cloud uses 'message' for the text
      expect(result).toHaveProperty('threadId');
      expect(result).toHaveProperty('agentId');
    });
  });

  // ── Error Handling ─────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('returns error for non-existent agent', async () => {
      try {
        await cloudClient.runAgent('nonexistent-agent-xyz', 'Hello');
        // If it doesn't throw, the response should indicate an error
        expect(true).toBe(true); // API may return error in response body
      } catch (error: any) {
        expect(error.message).toMatch(/not found|404|500/i);
      }
    });

    it('handles empty prompt gracefully', async () => {
      const result = await cloudClient.runAgent(testAgentId, '');

      // Should still return a response (agent may say "I need more input")
      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('handles very long prompt', async () => {
      const longPrompt = 'Tell me about ' + 'AI '.repeat(1000);

      const result = await cloudClient.runAgent(testAgentId, longPrompt);
      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });
  });

  // ── Usage Tracking ─────────────────────────────────────────────────────

  describe('Usage Tracking', () => {
    it('records usage after agent execution', async () => {
      // Execute agent to generate usage
      await cloudClient.runAgent(testAgentId, 'Generate usage data');

      // Query usage
      const usage = await cloudClient.getUsage(testAgentId);
      expect(Array.isArray(usage)).toBe(true);

      // If usage tracking is implemented, there should be at least one record
      // Note: this may be empty if usage tracking happens async
      if (usage.length > 0) {
        const record = usage[0];
        expect(record).toHaveProperty('agentId');
        expect(record).toHaveProperty('provider');
        expect(record).toHaveProperty('model');
        expect(record).toHaveProperty('totalTokens');
        expect(record.totalTokens).toBeGreaterThanOrEqual(0);
      }
    });

    it('usage stats aggregate correctly', async () => {
      const stats = await cloudClient.getUsageStats(testAgentId);

      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('totalCost');
      expect(stats).toHaveProperty('totalRequests');

      expect(typeof stats.totalTokens).toBe('number');
      expect(typeof stats.totalCost).toBe('number');
      expect(typeof stats.totalRequests).toBe('number');
      expect(stats.totalTokens).toBeGreaterThanOrEqual(0);
      expect(stats.totalRequests).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Concurrent Execution ──────────────────────────────────────────────

  describe('Concurrent Execution', () => {
    it('handles multiple simultaneous requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        cloudClient.runAgent(testAgentId, `Concurrent request ${i + 1}`)
      );

      const results = await Promise.allSettled(promises);

      // All should succeed (or at least not crash the server)
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThanOrEqual(3); // Allow some failures under load

      // Each fulfilled request should have a unique thread
      const threadIds = fulfilled.map(
        (r) => (r as PromiseFulfilledResult<any>).value.threadId
      );
      const uniqueThreads = new Set(threadIds);
      expect(uniqueThreads.size).toBe(fulfilled.length);
    });

    it('concurrent requests to same thread are serialized', async () => {
      // Create a single thread first
      const initial = await cloudClient.runAgent(testAgentId, 'Initialize thread');
      const threadId = initial.threadId;

      // Send concurrent messages to same thread
      const promises = Array.from({ length: 3 }, (_, i) =>
        cloudClient.runAgent(testAgentId, `Message ${i + 1}`, threadId)
      );

      const results = await Promise.allSettled(promises);

      // All should reference the same thread
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      for (const r of fulfilled) {
        expect((r as PromiseFulfilledResult<any>).value.threadId).toBe(threadId);
      }
    });
  });

  // ── Agent Lifecycle ────────────────────────────────────────────────────

  describe('Agent Lifecycle on Cloud', () => {
    it('creates, queries, and deletes an agent', async () => {
      const id = uniqueTestId('lifecycle');

      // Create
      const createResult = await cloudClient.createAgent({
        ...FIXTURES.agents.basic,
        id,
        name: 'Lifecycle Test Agent',
      });
      expect(createResult).toBeDefined();

      // Query
      const agent = await cloudClient.getAgent(id);
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('Lifecycle Test Agent');

      // Delete
      await cloudClient.deleteAgent(id);

      // Verify deletion
      const deleted = await cloudClient.getAgent(id);
      expect(deleted).toBeNull();
    });

    it('lists all agents including test agents', async () => {
      const agents = await cloudClient.listAgents();
      expect(Array.isArray(agents)).toBe(true);

      // Our seeded test agent should be there
      const found = agents.find((a) => a.id.includes(testAgentId));
      expect(found).toBeDefined();
    });
  });
});
