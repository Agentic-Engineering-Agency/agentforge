import { describe, it, expect } from 'vitest'
import { BundledSkillRegistry, BUNDLED_SKILLS, bundledSkillRegistry } from './bundled-registry.js'
import { WebSearchSkill, CalculatorSkill, DateTimeSkill, UrlFetchSkill, FileReaderSkill } from './bundled-index.js'

describe('BundledSkillRegistry', () => {
  it('lists all bundled skills', () => {
    const registry = new BundledSkillRegistry()
    const skills = registry.list()
    expect(skills.length).toBeGreaterThanOrEqual(5)
    expect(skills.map(s => s.name)).toContain('web-search')
    expect(skills.map(s => s.name)).toContain('calculator')
  })

  it('gets skill by name', () => {
    const registry = new BundledSkillRegistry()
    const calc = registry.get('calculator')
    expect(calc).toBeTruthy()
    expect(calc!.name).toBe('calculator')
  })

  it('calculator can evaluate 2+2', async () => {
    const registry = new BundledSkillRegistry()
    const calc = registry.get('calculator')!
    const result = await calc.execute({ expression: '2+2' })
    expect(result).toContain('4')
    const parsed = JSON.parse(result)
    expect(parsed.result).toBe(4)
  })

  it('datetime returns current date', async () => {
    const registry = new BundledSkillRegistry()
    const dt = registry.get('datetime')!
    const result = await dt.execute({ format: 'iso' })
    const parsed = JSON.parse(result)
    expect(parsed.result).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('web-search handles search query', async () => {
    const registry = new BundledSkillRegistry()
    const search = registry.get('web-search')!
    const result = await search.execute({ query: 'test' })
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('query', 'test')
    expect(parsed).toHaveProperty('results')
  })

  it('url-fetch validates URL input', async () => {
    const registry = new BundledSkillRegistry()
    const fetch = registry.get('url-fetch')!
    const result = await fetch.execute({ url: 'not-a-url' })
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('error')
  })

  it('calculator rejects invalid characters', async () => {
    const registry = new BundledSkillRegistry()
    const calc = registry.get('calculator')!
    const result = await calc.execute({ expression: 'eval("malicious")' })
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('error')
  })

  it('getByCategory returns correct skills', () => {
    const registry = new BundledSkillRegistry()
    const computation = registry.getByCategory('computation')
    expect(computation.length).toBeGreaterThan(0)
    expect(computation[0]!.name).toBe('calculator')
  })

  it('global singleton registry works', () => {
    expect(bundledSkillRegistry.size).toBeGreaterThanOrEqual(5)
    expect(bundledSkillRegistry.get('datetime')).toBeTruthy()
  })

  it('execute method works via registry', async () => {
    const registry = new BundledSkillRegistry()
    const result = await registry.execute('calculator', { expression: '3*3' })
    const parsed = JSON.parse(result)
    expect(parsed.result).toBe(9)
  })

  it('returns error for unknown skill', async () => {
    const registry = new BundledSkillRegistry()
    const result = await registry.execute('unknown-skill', {})
    const parsed = JSON.parse(result)
    expect(parsed.error).toContain('not found')
  })
})

describe('BUNDLED_SKILLS array', () => {
  it('exports all 5 bundled skills', () => {
    expect(BUNDLED_SKILLS).toHaveLength(5)
    const names = BUNDLED_SKILLS.map(s => s.name)
    expect(names).toContain('web-search')
    expect(names).toContain('calculator')
    expect(names).toContain('datetime')
    expect(names).toContain('url-fetch')
    expect(names).toContain('file-reader')
  })

  it('each skill has required properties', () => {
    for (const skill of BUNDLED_SKILLS) {
      expect(skill.name).toBeTruthy()
      expect(skill.description).toBeTruthy()
      expect(skill.category).toBeTruthy()
      expect(typeof skill.execute).toBe('function')
    }
  })
})

describe('Individual skill exports', () => {
  it('exports WebSearchSkill', () => {
    expect(WebSearchSkill.name).toBe('web-search')
    expect(WebSearchSkill.category).toBe('web')
  })

  it('exports CalculatorSkill', () => {
    expect(CalculatorSkill.name).toBe('calculator')
    expect(CalculatorSkill.category).toBe('computation')
  })

  it('exports DateTimeSkill', () => {
    expect(DateTimeSkill.name).toBe('datetime')
    expect(DateTimeSkill.category).toBe('datetime')
  })

  it('exports UrlFetchSkill', () => {
    expect(UrlFetchSkill.name).toBe('url-fetch')
    expect(UrlFetchSkill.category).toBe('io')
  })

  it('exports FileReaderSkill', () => {
    expect(FileReaderSkill.name).toBe('file-reader')
    expect(FileReaderSkill.category).toBe('io')
  })
})
