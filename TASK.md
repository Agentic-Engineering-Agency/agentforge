# TASK: Fix SPEC-025 — agentforge research (ResearchOrchestrator Mastra v1.8)

## The Bug
`agentforge research "topic"` hangs silently at "Step 1: Planning". Zero output.

## Root Cause
`packages/core/src/research/orchestrator.ts` creates MastraAgent with OLD API:

```ts
// BROKEN - old Mastra API, silently fails in v1.8:
new MastraAgent({
  model: {
    providerId: agentConfig.providerId,
    modelId: agentConfig.modelId,
    apiKey: agentConfig.apiKey,
  }
})
```

## Fix Required
Mastra v1.8 requires:
1. Set API key in `process.env` BEFORE creating agent
2. Pass model as string `"provider/model"` format

```ts
// CORRECT - confirmed working in packages/cli/src/commands/start.ts:
const envKey = `${agentConfig.providerId.toUpperCase()}_API_KEY`;
if (!process.env[envKey]) process.env[envKey] = agentConfig.apiKey;

new MastraAgent({
  id: 'research-planner',
  name: 'Research Planner',
  instructions: '...',
  model: `${agentConfig.providerId}/${agentConfig.modelId}`,
})
```

Apply this fix to ALL three agent instantiations in orchestrator.ts:
- `research-planner` in `_plannerStep()`
- `researcher-N` in `_researchStep()` (inside the .map())
- `synthesizer` in `_synthesisStep()`

Add a `setupProviderEnv(agentConfig)` helper at the top of the class to avoid repetition.

## SpecSafe Workflow
1. Read spec: `cat specs/active/SPEC-025-research-orchestrator-fix.md`
2. Read current file: `cat packages/core/src/research/orchestrator.ts`
3. Fix the file
4. Typecheck: `pnpm --filter @agentforge-ai/core run typecheck`
5. Test: `pnpm --filter @agentforge-ai/core test`
6. Manual verify: `OPENAI_API_KEY="$OPENAI_API_KEY" agentforge research "What is Mastra.ai?" --depth shallow`
7. Commit: `git add -A && git commit -m "fix(core): ResearchOrchestrator Mastra v1.8 compat (SPEC-025)"`
8. Push: `git push -u origin fix/spec-025-research-orchestrator`
9. Open PR to main

## Done Signal
Run when finished: `openclaw system event --text "SPEC-025 done: research fixed, PR open" --mode now`
