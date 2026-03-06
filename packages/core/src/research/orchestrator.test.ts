import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResearchOrchestrator } from './orchestrator.js';

// Mock Mastra Agent to avoid real API calls in tests (Mastra v1.8 reads from process.env)
vi.mock('@mastra/core/agent', () => {
  const Agent = vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      text: '[{"id":"q1","question":"What is AI?"},{"id":"q2","question":"How does AI work?"},{"id":"q3","question":"What are AI applications?"}]',
    }),
  }));
  return { Agent };
});

describe('ResearchOrchestrator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('instantiates with a topic', () => {
    const orch = new ResearchOrchestrator({ topic: 'AI agents', depth: 'shallow' });
    expect(orch.topic).toBe('AI agents');
    expect(orch.depth).toBe('shallow');
  });

  it('shallow depth uses 3 research agents', () => {
    const orch = new ResearchOrchestrator({ topic: 'test', depth: 'shallow' });
    expect(orch.agentCount).toBe(3);
  });

  it('standard depth uses 5 research agents', () => {
    const orch = new ResearchOrchestrator({ topic: 'test', depth: 'standard' });
    expect(orch.agentCount).toBe(5);
  });

  it('deep depth uses 10 research agents', () => {
    const orch = new ResearchOrchestrator({ topic: 'test', depth: 'deep' });
    expect(orch.agentCount).toBe(10);
  });

  it('has a run() method', () => {
    const orch = new ResearchOrchestrator({ topic: 'test', depth: 'shallow' });
    expect(typeof orch.run).toBe('function');
  });

  describe('Mastra v1.8 compatibility', () => {
    it('sets provider API key in process.env before creating agents', async () => {
      const testApiKey = 'sk-test-key-for-mastra-v18';
      delete process.env.OPENAI_API_KEY;

      const orch = new ResearchOrchestrator({ topic: 'test topic', depth: 'shallow' });

      await orch.run({
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        apiKey: testApiKey,
      });

      // After run(), the orchestrator must have injected the key into process.env
      expect(process.env.OPENAI_API_KEY).toBe(testApiKey);
    });

    it('uses model string format (provider/model) not object config', async () => {
      const { Agent } = await import('@mastra/core/agent');

      const orch = new ResearchOrchestrator({ topic: 'test', depth: 'shallow' });

      await orch.run({
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        apiKey: 'sk-test',
      });

      // Mastra v1.8: Agent must receive model as "provider/model" string, not config object
      const calls = (Agent as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [config] of calls) {
        expect(typeof config.model).toBe('string');
        expect(config.model).toBe('openai/gpt-4o-mini');
      }
    });

    it('run() returns a complete ResearchReport', async () => {
      const orch = new ResearchOrchestrator({ topic: 'AI agents', depth: 'shallow' });

      const report = await orch.run({
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        apiKey: 'sk-test',
      });

      expect(report.topic).toBe('AI agents');
      expect(report.depth).toBe('shallow');
      expect(Array.isArray(report.questions)).toBe(true);
      expect(Array.isArray(report.findings)).toBe(true);
      expect(typeof report.synthesis).toBe('string');
      expect(typeof report.timestamp).toBe('number');
    });
  });
});
