import { describe, it, expect, vi } from 'vitest'
import { AgentPipeline, PipelineStep } from './pipeline.js'

describe('AgentPipeline', () => {
  it('instantiates with name and steps', () => {
    const pipeline = new AgentPipeline({ name: 'test-pipeline', steps: [] })
    expect(pipeline.name).toBe('test-pipeline')
  })

  it('has addStep and run methods', () => {
    const pipeline = new AgentPipeline({ name: 'test', steps: [] })
    expect(typeof pipeline.addStep).toBe('function')
    expect(typeof pipeline.run).toBe('function')
  })

  it('runs steps in sequence', async () => {
    const order: number[] = []
    const pipeline = new AgentPipeline({ name: 'seq', steps: [] })
    pipeline.addStep({ name: 's1', execute: async () => { order.push(1); return 'a' } })
    pipeline.addStep({ name: 's2', execute: async (prev) => { order.push(2); return prev + 'b' } })
    const result = await pipeline.run()
    expect(order).toEqual([1, 2])
    expect(result).toBe('ab')
  })

  it('passes result from one step to next', async () => {
    const pipeline = new AgentPipeline({ name: 'chain', steps: [] })
    pipeline.addStep({ name: 'step1', execute: async () => 'hello' })
    pipeline.addStep({ name: 'step2', execute: async (prev) => `${prev} world` })
    const result = await pipeline.run()
    expect(result).toBe('hello world')
  })

  it('runs steps with initial input', async () => {
    const pipeline = new AgentPipeline({ name: 'init-test', steps: [] })
    pipeline.addStep({ name: 'step1', execute: async (prev) => `${prev} + 1` })
    const result = await pipeline.run('5')
    expect(result).toBe('5 + 1')
  })

  it('handles empty steps', async () => {
    const pipeline = new AgentPipeline({ name: 'empty', steps: [] })
    const result = await pipeline.run('initial')
    expect(result).toBe('initial')
  })

  it('handles parallel steps with Promise.all', async () => {
    const results: string[] = []
    const pipeline = new AgentPipeline({ name: 'parallel', steps: [] })

    pipeline.addStep({
      name: 'parallel-group',
      execute: async () => {
        const [r1, r2] = await Promise.all([
          Promise.resolve('first'),
          Promise.resolve('second')
        ])
        return `${r1}-${r2}`
      }
    })

    const result = await pipeline.run()
    expect(result).toBe('first-second')
  })

  it('supports context object in steps', async () => {
    const pipeline = new AgentPipeline({
      name: 'ctx-test',
      steps: [],
      context: { userId: 'user-123', traceId: 'trace-456' }
    })

    pipeline.addStep({
      name: 'step-with-ctx',
      execute: async (prev, ctx) => {
        expect(ctx?.userId).toBe('user-123')
        return 'done'
      }
    })

    await pipeline.run()
  })

  it('tracks step execution history', async () => {
    const pipeline = new AgentPipeline({ name: 'history-test', steps: [] })
    pipeline.addStep({ name: 'first', execute: async () => 'result1' })
    pipeline.addStep({ name: 'second', execute: async () => 'result2' })

    await pipeline.run()

    expect(pipeline.getHistory()).toHaveLength(2)
    expect(pipeline.getHistory()[0].stepName).toBe('first')
    expect(pipeline.getHistory()[1].stepName).toBe('second')
  })

  it('handles step errors gracefully', async () => {
    const pipeline = new AgentPipeline({ name: 'error-test', steps: [] })
    pipeline.addStep({
      name: 'failing-step',
      execute: async () => { throw new Error('Step failed') }
    })

    await expect(pipeline.run()).rejects.toThrow('Step failed')
  })

  it('allows adding steps via constructor', async () => {
    const steps: PipelineStep[] = [
      { name: 's1', execute: async () => 'a' },
      { name: 's2', execute: async (prev) => `${prev}b` }
    ]
    const pipeline = new AgentPipeline({ name: 'constructor-test', steps })
    const result = await pipeline.run()
    expect(result).toBe('ab')
  })
})
