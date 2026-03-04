import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsSource = readFileSync(join(__dirname, '../convex/agents.ts'), 'utf-8');

describe('Agents Mutations - Failover Models Support (SPEC-016 Task 1)', () => {
  it('create mutation should accept failoverModels argument', () => {
    // Check that create mutation includes failoverModels in its args
    expect(agentsSource).toContain('failoverModels:');
    expect(agentsSource).toContain('v.optional(');
    expect(agentsSource).toContain('v.array(');
  });

  it('update mutation should accept failoverModels argument', () => {
    // Check that update mutation includes failoverModels in its args
    // Find the update mutation and verify it has failoverModels
    const createMatch = agentsSource.indexOf('export const create = mutation');
    const updateMatch = agentsSource.indexOf('export const update = mutation');
    expect(updateMatch).toBeGreaterThan(createMatch); // update comes after create
    expect(agentsSource.substring(updateMatch)).toContain('failoverModels:');
  });

  it('failoverModels should use the correct schema structure', () => {
    // Should contain v.object with provider and model fields
    expect(agentsSource).toContain('v.object({');
    expect(agentsSource).toContain('provider:');
    expect(agentsSource).toContain('v.string()');
    expect(agentsSource).toContain('model:');
  });
});

describe('Schema - Failover Models Field (SPEC-016 Task 1)', () => {
  const schemaSource = readFileSync(join(__dirname, '../convex/schema.ts'), 'utf-8');

  it('agents table should have failoverModels field', () => {
    // Check that failoverModels field exists in agents table
    expect(schemaSource).toContain('failoverModels:');
  });

  it('failoverModels should be an array of objects with provider and model', () => {
    // Verify the structure: v.array(v.object({ provider: v.string(), model: v.string() }))
    const failoverMatch = schemaSource.match(/failoverModels:\s*v\.optional\(([\s\S]+?\)\s*\)\s*,)/);
    expect(failoverMatch).toBeTruthy();
    if (failoverMatch) {
      const fieldDef = failoverMatch[1];
      expect(fieldDef).toContain('v.array(');
      expect(fieldDef).toContain('v.object({');
      expect(fieldDef).toContain('provider:');
      expect(fieldDef).toContain('v.string(');
      expect(fieldDef).toContain('model:');
    }
  });
});

describe('Auth Mutations - Login Support (SPEC-016 Task 2)', () => {
  const authSource = readFileSync(join(__dirname, '../convex/auth.ts'), 'utf-8');

  it('should have setPassword mutation', () => {
    expect(authSource).toMatch(/export const setPassword = mutation\(/);
  });

  it('should have validatePassword query', () => {
    expect(authSource).toMatch(/export const validatePassword = query\(/);
  });

  it('should have createSession mutation', () => {
    expect(authSource).toMatch(/export const createSession = mutation\(/);
  });

  it('should have getSession query', () => {
    expect(authSource).toMatch(/export const getSession = query\(/);
  });
});

describe('Mastra Integration - Sandbox Support (SPEC-016 Task 3)', () => {
  const mastraSource = readFileSync(join(__dirname, '../convex/mastraIntegration.ts'), 'utf-8');

  it('executeAgent action should exist', () => {
    expect(mastraSource).toMatch(/export const executeAgent = action\(/);
  });

  it('should reference failoverModels in buildFailoverChain function', () => {
    expect(mastraSource).toMatch(/failoverModels/);
  });

  it('should have buildFailoverChain function', () => {
    expect(mastraSource).toMatch(/function buildFailoverChain/);
  });
});
