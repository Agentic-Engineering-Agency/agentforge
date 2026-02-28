import { describe, it, expect, vi } from 'vitest';
import { ResearchOrchestrator } from './orchestrator.js';

describe('ResearchOrchestrator', () => {
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
});
