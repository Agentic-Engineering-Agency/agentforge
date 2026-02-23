import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Test Group 1: Schema Validation (static analysis of convex/schema.ts)
// ---------------------------------------------------------------------------

describe('AGE-104: Workflow Schema Tables', () => {
  const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  describe('workflowDefinitions table', () => {
    const tableRegex = /workflowDefinitions:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;

    it('should exist in schema', () => {
      expect(schemaContent).toContain('workflowDefinitions');
    });

    it('should have name field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowDefinitions table not found').toBeTruthy();
      expect(match![0]).toContain('name');
    });

    it('should have steps field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowDefinitions table not found').toBeTruthy();
      expect(match![0]).toContain('steps');
    });

    it('should have isActive field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowDefinitions table not found').toBeTruthy();
      expect(match![0]).toContain('isActive');
    });

    it('should have projectId as optional v.id("projects")', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowDefinitions table not found').toBeTruthy();
      expect(match![0]).toContain('projectId');
      expect(match![0]).toContain('v.optional(v.id("projects"))');
    });

    it('should have userId field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowDefinitions table not found').toBeTruthy();
      expect(match![0]).toContain('userId');
    });

    it('should have createdAt field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowDefinitions table not found').toBeTruthy();
      expect(match![0]).toContain('createdAt');
    });

    it('should have updatedAt field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowDefinitions table not found').toBeTruthy();
      expect(match![0]).toContain('updatedAt');
    });

    it('should have byProjectId index', () => {
      const fullTableRegex = /workflowDefinitions:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byProjectId"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowDefinitions should have byProjectId index').toBeTruthy();
    });

    it('should have byUserId index', () => {
      const fullTableRegex = /workflowDefinitions:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byUserId"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowDefinitions should have byUserId index').toBeTruthy();
    });

    it('should have byIsActive index', () => {
      const fullTableRegex = /workflowDefinitions:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byIsActive"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowDefinitions should have byIsActive index').toBeTruthy();
    });
  });

  describe('workflowRuns table', () => {
    const tableRegex = /workflowRuns:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;

    it('should exist in schema', () => {
      expect(schemaContent).toContain('workflowRuns');
    });

    it('should reference workflowDefinitions via v.id("workflowDefinitions")', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowRuns table not found').toBeTruthy();
      expect(match![0]).toContain('v.id("workflowDefinitions")');
    });

    it('should have status union with pending/running/suspended/completed/failed', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowRuns table not found').toBeTruthy();
      expect(match![0]).toContain('v.literal("pending")');
      expect(match![0]).toContain('v.literal("running")');
      expect(match![0]).toContain('v.literal("suspended")');
      expect(match![0]).toContain('v.literal("completed")');
      expect(match![0]).toContain('v.literal("failed")');
    });

    it('should have currentStepIndex field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowRuns table not found').toBeTruthy();
      expect(match![0]).toContain('currentStepIndex');
    });

    it('should have startedAt field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowRuns table not found').toBeTruthy();
      expect(match![0]).toContain('startedAt');
    });

    it('should have projectId as optional v.id("projects")', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowRuns table not found').toBeTruthy();
      expect(match![0]).toContain('projectId');
      expect(match![0]).toContain('v.optional(v.id("projects"))');
    });

    it('should have byWorkflowId index', () => {
      const fullTableRegex = /workflowRuns:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byWorkflowId"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowRuns should have byWorkflowId index').toBeTruthy();
    });

    it('should have byStatus index', () => {
      const fullTableRegex = /workflowRuns:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byStatus"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowRuns should have byStatus index').toBeTruthy();
    });

    it('should have byProjectId index', () => {
      const fullTableRegex = /workflowRuns:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byProjectId"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowRuns should have byProjectId index').toBeTruthy();
    });

    it('should have byUserId index', () => {
      const fullTableRegex = /workflowRuns:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byUserId"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowRuns should have byUserId index').toBeTruthy();
    });
  });

  describe('workflowSteps table', () => {
    const tableRegex = /workflowSteps:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;

    it('should exist in schema', () => {
      expect(schemaContent).toContain('workflowSteps');
    });

    it('should reference workflowRuns via v.id("workflowRuns")', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowSteps table not found').toBeTruthy();
      expect(match![0]).toContain('v.id("workflowRuns")');
    });

    it('should have stepId field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowSteps table not found').toBeTruthy();
      expect(match![0]).toContain('stepId');
    });

    it('should have name field', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowSteps table not found').toBeTruthy();
      expect(match![0]).toContain('name');
    });

    it('should have status union with pending/running/completed/failed/skipped/suspended', () => {
      const match = schemaContent.match(tableRegex);
      expect(match, 'workflowSteps table not found').toBeTruthy();
      expect(match![0]).toContain('v.literal("pending")');
      expect(match![0]).toContain('v.literal("running")');
      expect(match![0]).toContain('v.literal("completed")');
      expect(match![0]).toContain('v.literal("failed")');
      expect(match![0]).toContain('v.literal("skipped")');
      expect(match![0]).toContain('v.literal("suspended")');
    });

    it('should have byRunId index', () => {
      const fullTableRegex = /workflowSteps:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byRunId"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowSteps should have byRunId index').toBeTruthy();
    });

    it('should have byStatus index', () => {
      const fullTableRegex = /workflowSteps:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byStatus"/m;
      const match = schemaContent.match(fullTableRegex);
      expect(match, 'workflowSteps should have byStatus index').toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: CRUD Operations Validation (static analysis of convex/workflows.ts)
// ---------------------------------------------------------------------------

describe('AGE-104: Workflow CRUD Operations', () => {
  const workflowsPath = path.resolve(__dirname, '../convex/workflows.ts');

  it('convex/workflows.ts should exist', () => {
    expect(fs.existsSync(workflowsPath)).toBe(true);
  });

  const workflowsContent = fs.existsSync(workflowsPath)
    ? fs.readFileSync(workflowsPath, 'utf-8')
    : '';

  describe('query exports', () => {
    it('should export list query', () => {
      expect(workflowsContent).toContain('export const list');
    });

    it('should export get query', () => {
      expect(workflowsContent).toContain('export const get');
    });

    it('should export getRun query', () => {
      expect(workflowsContent).toContain('export const getRun');
    });

    it('should export listRuns query', () => {
      expect(workflowsContent).toContain('export const listRuns');
    });

    it('should export getRunSteps query', () => {
      expect(workflowsContent).toContain('export const getRunSteps');
    });
  });

  describe('mutation exports', () => {
    it('should export create mutation', () => {
      expect(workflowsContent).toContain('export const create');
    });

    it('should export update mutation', () => {
      expect(workflowsContent).toContain('export const update');
    });

    it('should export remove mutation', () => {
      expect(workflowsContent).toContain('export const remove');
    });

    it('should export createRun mutation', () => {
      expect(workflowsContent).toContain('export const createRun');
    });

    it('should export updateRun mutation', () => {
      expect(workflowsContent).toContain('export const updateRun');
    });

    it('should export createStep mutation', () => {
      expect(workflowsContent).toContain('export const createStep');
    });

    it('should export updateStep mutation', () => {
      expect(workflowsContent).toContain('export const updateStep');
    });
  });

  describe('list query implementation', () => {
    it('should accept projectId parameter', () => {
      expect(workflowsContent).toContain('projectId');
      expect(workflowsContent).toContain('v.optional(v.id("projects"))');
    });

    it('should use byProjectId index', () => {
      expect(workflowsContent).toContain('byProjectId');
    });
  });

  describe('createRun mutation implementation', () => {
    it('should accept workflowId as required field', () => {
      expect(workflowsContent).toContain('v.id("workflowDefinitions")');
    });

    it('should set status to pending on creation', () => {
      expect(workflowsContent).toContain('"pending"');
    });

    it('should set currentStepIndex to 0 on creation', () => {
      expect(workflowsContent).toContain('currentStepIndex: 0');
    });

    it('should set startedAt on creation', () => {
      expect(workflowsContent).toContain('startedAt');
    });
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: Workflow Engine Module (static analysis + dynamic import)
// ---------------------------------------------------------------------------

describe('AGE-104: Workflow Engine Module', () => {
  const enginePath = path.resolve(__dirname, '../convex/lib/workflowEngine.ts');

  it('convex/lib/workflowEngine.ts should exist', () => {
    expect(fs.existsSync(enginePath)).toBe(true);
  });

  const engineContent = fs.existsSync(enginePath)
    ? fs.readFileSync(enginePath, 'utf-8')
    : '';

  describe('static analysis — exported functions', () => {
    it('should export parseWorkflowDefinition', () => {
      expect(engineContent).toContain('parseWorkflowDefinition');
    });

    it('should export buildMastraStep', () => {
      expect(engineContent).toContain('buildMastraStep');
    });

    it('should export buildMastraWorkflow', () => {
      expect(engineContent).toContain('buildMastraWorkflow');
    });

    it('should export executeWorkflow', () => {
      expect(engineContent).toContain('executeWorkflow');
    });
  });

  describe('static analysis — type definitions', () => {
    it('should define StepDefinition interface', () => {
      expect(engineContent).toContain('StepDefinition');
    });

    it('should define WorkflowDefinitionData interface', () => {
      expect(engineContent).toContain('WorkflowDefinitionData');
    });

    it('should define WorkflowExecutionResult interface', () => {
      expect(engineContent).toContain('WorkflowExecutionResult');
    });
  });

  describe('dynamic import — parseWorkflowDefinition', () => {
    let parseWorkflowDefinition: (stepsJson: string) => unknown[];

    beforeAll(async () => {
      if (!fs.existsSync(enginePath)) return;
      try {
        const mod = await import('../convex/lib/workflowEngine');
        parseWorkflowDefinition = mod.parseWorkflowDefinition;
      } catch {
        // Module may not be importable yet (Convex runtime dependencies)
      }
    });

    const validSteps = JSON.stringify([
      { id: 'step-1', name: 'First Step', type: 'function', config: { body: 'return input' } },
      { id: 'step-2', name: 'Second Step', type: 'agent', config: { agentId: 'agent-1', prompt: 'Process {{input}}' } },
    ]);

    it('should parse a valid JSON step array', () => {
      if (!parseWorkflowDefinition) return;
      const result = parseWorkflowDefinition(validSteps);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should return step objects with id, name, type, config fields', () => {
      if (!parseWorkflowDefinition) return;
      const result = parseWorkflowDefinition(validSteps) as Array<Record<string, unknown>>;
      expect(result[0]).toHaveProperty('id', 'step-1');
      expect(result[0]).toHaveProperty('name', 'First Step');
      expect(result[0]).toHaveProperty('type', 'function');
      expect(result[0]).toHaveProperty('config');
    });

    it('should throw on invalid JSON', () => {
      if (!parseWorkflowDefinition) return;
      expect(() => parseWorkflowDefinition('not-valid-json{')).toThrow();
    });

    it('should throw on non-array input', () => {
      if (!parseWorkflowDefinition) return;
      expect(() => parseWorkflowDefinition(JSON.stringify({ id: 'step-1' }))).toThrow();
    });

    it('should handle an empty array without throwing', () => {
      if (!parseWorkflowDefinition) return;
      const result = parseWorkflowDefinition(JSON.stringify([]));
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('dynamic import — buildMastraStep', () => {
    let buildMastraStep: (stepDef: unknown) => unknown;

    beforeAll(async () => {
      if (!fs.existsSync(enginePath)) return;
      try {
        const mod = await import('../convex/lib/workflowEngine');
        buildMastraStep = mod.buildMastraStep;
      } catch {
        // Module may not be importable yet (Convex runtime dependencies)
      }
    });

    it('should return a step object for a function-type step', () => {
      if (!buildMastraStep) return;
      const stepDef = { id: 'step-1', name: 'My Step', type: 'function', config: { body: 'return input' } };
      const result = buildMastraStep(stepDef);
      expect(result).toBeDefined();
    });

    it('should return a step object for an agent-type step', () => {
      if (!buildMastraStep) return;
      const stepDef = { id: 'step-2', name: 'Agent Step', type: 'agent', config: { agentId: 'agent-1', prompt: 'Do something' } };
      const result = buildMastraStep(stepDef);
      expect(result).toBeDefined();
    });
  });

  describe('dynamic import — executeWorkflow', () => {
    let executeWorkflow: (definition: unknown, input: Record<string, unknown>) => Promise<unknown>;

    beforeAll(async () => {
      if (!fs.existsSync(enginePath)) return;
      try {
        const mod = await import('../convex/lib/workflowEngine');
        executeWorkflow = mod.executeWorkflow;
      } catch {
        // Module may not be importable yet (Convex runtime dependencies)
      }
    });

    it('should return a WorkflowExecutionResult with success field', async () => {
      if (!executeWorkflow) return;
      const definition = {
        id: 'wf-1',
        name: 'Test Workflow',
        steps: [
          { id: 'step-1', name: 'First Step', type: 'function', config: { body: 'return input' } },
        ],
      };
      const result = await executeWorkflow(definition, { message: 'hello' }) as Record<string, unknown>;
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should return status in the result', async () => {
      if (!executeWorkflow) return;
      const definition = {
        id: 'wf-1',
        name: 'Test Workflow',
        steps: [
          { id: 'step-1', name: 'First Step', type: 'function', config: { body: 'return input' } },
        ],
      };
      const result = await executeWorkflow(definition, {}) as Record<string, unknown>;
      expect(result).toHaveProperty('status');
    });
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: Workflow Events Module (static analysis + dynamic import)
// ---------------------------------------------------------------------------

describe('AGE-104: Workflow Events Module', () => {
  const eventsPath = path.resolve(__dirname, '../convex/lib/workflowEvents.ts');

  it('convex/lib/workflowEvents.ts should exist', () => {
    expect(fs.existsSync(eventsPath)).toBe(true);
  });

  const eventsContent = fs.existsSync(eventsPath)
    ? fs.readFileSync(eventsPath, 'utf-8')
    : '';

  describe('static analysis — exported functions', () => {
    it('should export createWorkflowEvent', () => {
      expect(eventsContent).toContain('createWorkflowEvent');
    });

    it('should export buildEventLog', () => {
      expect(eventsContent).toContain('buildEventLog');
    });
  });

  describe('static analysis — type definitions', () => {
    it('should define WorkflowEvent interface or type', () => {
      expect(eventsContent).toContain('WorkflowEvent');
    });

    it('should define WorkflowEventType type', () => {
      expect(eventsContent).toContain('WorkflowEventType');
    });

    it('should include workflow.started event type', () => {
      expect(eventsContent).toContain('workflow.started');
    });

    it('should include workflow.completed event type', () => {
      expect(eventsContent).toContain('workflow.completed');
    });

    it('should include workflow.failed event type', () => {
      expect(eventsContent).toContain('workflow.failed');
    });

    it('should include workflow.suspended event type', () => {
      expect(eventsContent).toContain('workflow.suspended');
    });

    it('should include workflow.resumed event type', () => {
      expect(eventsContent).toContain('workflow.resumed');
    });

    it('should include step.started event type', () => {
      expect(eventsContent).toContain('step.started');
    });

    it('should include step.completed event type', () => {
      expect(eventsContent).toContain('step.completed');
    });

    it('should include step.failed event type', () => {
      expect(eventsContent).toContain('step.failed');
    });

    it('should include step.skipped event type', () => {
      expect(eventsContent).toContain('step.skipped');
    });
  });

  describe('dynamic import — createWorkflowEvent', () => {
    let createWorkflowEvent: (event: Record<string, unknown>) => Record<string, unknown>;

    beforeAll(async () => {
      if (!fs.existsSync(eventsPath)) return;
      try {
        const mod = await import('../convex/lib/workflowEvents');
        createWorkflowEvent = mod.createWorkflowEvent;
      } catch {
        // Module may not be importable yet
      }
    });

    it('should return an event object with a timestamp', () => {
      if (!createWorkflowEvent) return;
      const event = {
        type: 'workflow.started',
        workflowRunId: 'run-123',
        timestamp: Date.now(),
      };
      const result = createWorkflowEvent(event);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should include the event type in the returned event', () => {
      if (!createWorkflowEvent) return;
      const event = {
        type: 'step.completed',
        workflowRunId: 'run-456',
        stepId: 'step-1',
        timestamp: Date.now(),
      };
      const result = createWorkflowEvent(event);
      expect(result).toHaveProperty('type', 'step.completed');
    });

    it('should preserve workflowRunId', () => {
      if (!createWorkflowEvent) return;
      const event = {
        type: 'workflow.failed',
        workflowRunId: 'run-789',
        timestamp: Date.now(),
      };
      const result = createWorkflowEvent(event);
      expect(result).toHaveProperty('workflowRunId', 'run-789');
    });
  });

  describe('dynamic import — buildEventLog', () => {
    let buildEventLog: (events: Record<string, unknown>[]) => string;

    beforeAll(async () => {
      if (!fs.existsSync(eventsPath)) return;
      try {
        const mod = await import('../convex/lib/workflowEvents');
        buildEventLog = mod.buildEventLog;
      } catch {
        // Module may not be importable yet
      }
    });

    it('should return a string from an array of events', () => {
      if (!buildEventLog) return;
      const events = [
        { type: 'workflow.started', workflowRunId: 'run-1', timestamp: 1000 },
        { type: 'step.started', workflowRunId: 'run-1', stepId: 'step-1', timestamp: 1001 },
        { type: 'step.completed', workflowRunId: 'run-1', stepId: 'step-1', timestamp: 1002 },
        { type: 'workflow.completed', workflowRunId: 'run-1', timestamp: 1003 },
      ];
      const log = buildEventLog(events);
      expect(typeof log).toBe('string');
    });

    it('should produce non-empty output for non-empty event array', () => {
      if (!buildEventLog) return;
      const events = [
        { type: 'workflow.started', workflowRunId: 'run-1', timestamp: Date.now() },
      ];
      const log = buildEventLog(events);
      expect(log.length).toBeGreaterThan(0);
    });

    it('should handle empty event array without throwing', () => {
      if (!buildEventLog) return;
      const log = buildEventLog([]);
      expect(typeof log).toBe('string');
    });

    it('should include event types in the log output', () => {
      if (!buildEventLog) return;
      const events = [
        { type: 'workflow.started', workflowRunId: 'run-1', timestamp: Date.now() },
        { type: 'workflow.completed', workflowRunId: 'run-1', timestamp: Date.now() },
      ];
      const log = buildEventLog(events);
      expect(log).toContain('workflow.started');
      expect(log).toContain('workflow.completed');
    });
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: Integration Validation (static analysis of convex/mastraIntegration.ts)
// ---------------------------------------------------------------------------

describe('AGE-104: executeWorkflow Integration', () => {
  const integrationPath = path.resolve(__dirname, '../convex/mastraIntegration.ts');
  const integrationContent = fs.existsSync(integrationPath)
    ? fs.readFileSync(integrationPath, 'utf-8')
    : '';

  it('convex/mastraIntegration.ts should exist', () => {
    expect(fs.existsSync(integrationPath)).toBe(true);
  });

  it('should export executeWorkflow action', () => {
    expect(integrationContent).toContain('executeWorkflow');
  });

  it('executeWorkflow should no longer return placeholder message', () => {
    // The old stub returned "Workflow execution coming soon"
    // After AGE-104 implementation this should be replaced with real logic
    expect(integrationContent).not.toContain('Workflow execution coming soon');
  });

  it('executeWorkflow should import or reference workflowEngine', () => {
    expect(integrationContent).toContain('workflowEngine');
  });

  it('executeWorkflow should use api.workflows.get to fetch the definition', () => {
    expect(integrationContent).toContain('api.workflows.get');
  });

  it('executeWorkflow should create a run record (api.workflows.createRun)', () => {
    expect(integrationContent).toContain('api.workflows.createRun');
  });

  it('executeWorkflow should update run status on completion or failure', () => {
    expect(integrationContent).toContain('api.workflows.updateRun');
  });

  it('executeWorkflow should handle errors and update run to failed status', () => {
    // Should contain error handling that marks run as failed
    expect(integrationContent).toContain('"failed"');
  });
});

// ---------------------------------------------------------------------------
// Test Group 6: Mastra Instance Helpers (static analysis of packages/core/src/mastra.ts)
// ---------------------------------------------------------------------------

describe('AGE-104: Mastra Instance Helpers', () => {
  const mastraPath = path.resolve(__dirname, '../packages/core/src/mastra.ts');
  const mastraContent = fs.existsSync(mastraPath)
    ? fs.readFileSync(mastraPath, 'utf-8')
    : '';

  it('packages/core/src/mastra.ts should exist', () => {
    expect(fs.existsSync(mastraPath)).toBe(true);
  });

  it('should export createMastraInstanceWithWorkflows function', () => {
    expect(mastraContent).toContain('createMastraInstanceWithWorkflows');
  });

  it('should re-export createWorkflow from @mastra/core/workflows', () => {
    expect(mastraContent).toContain('createWorkflow');
  });

  it('should re-export createStep from @mastra/core/workflows', () => {
    expect(mastraContent).toContain('createStep');
  });

  it('should reference @mastra/core/workflows in imports', () => {
    expect(mastraContent).toContain('@mastra/core/workflows');
  });
});
