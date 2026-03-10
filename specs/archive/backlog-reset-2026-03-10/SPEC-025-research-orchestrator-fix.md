# SPEC-025: Fix agentforge research (ResearchOrchestrator Mastra v1.8 compatibility)

**Status:** Active  
**Priority:** P1 — User-facing feature completely broken  
**Scope:** `packages/core/src/research/orchestrator.ts`

---

## Problem

`agentforge research <topic>` hangs silently at "Step 1: Planning" and produces no output.

**Root cause:** `ResearchOrchestrator` constructs `MastraAgent` using old API:
```ts
new MastraAgent({
  model: {
    providerId: agentConfig.providerId,  // ← BROKEN in Mastra v1.8
    modelId: agentConfig.modelId,
    apiKey: agentConfig.apiKey,
  }
})
```

In Mastra v1.8, `Agent` constructor does NOT accept `model` as a config object.  
The correct pattern (confirmed by testing in the runtime package):
```ts
// Set API key in process.env BEFORE creating agent
process.env[`${provider.toUpperCase()}_API_KEY`] = apiKey;

// Pass model as "provider/model" string
new MastraAgent({
  model: "openai/gpt-4o-mini",  // ← Mastra v1.8 model string format
  ...
})
```

This is exactly how `packages/cli/src/commands/start.ts` already does it (confirmed working).

---

## Evidence

1. `agentforge research "Mastra.ai"` hangs indefinitely at planning step
2. Stream debug confirmed Mastra v1.8 chunk format: `{ type: 'text-delta', payload: { text: '...' } }`
3. `createStandardAgent({ model: "openai/gpt-4o-mini" })` works in runtime
4. Old `MastraAgent({ model: { providerId, modelId, apiKey } })` silently fails

---

## Required Changes

### `packages/core/src/research/orchestrator.ts`

**1. Update ResearchAgentConfig** — remove apiKey from config (it's set via env):
```ts
export interface ResearchAgentConfig {
  providerId: string;
  modelId: string;
  apiKey: string;  // keep for backwards compat, but inject into process.env
}
```

**2. Add helper to set API key in env and build model string:**
```ts
function setupProviderEnv(agentConfig: ResearchAgentConfig): string {
  const envKey = `${agentConfig.providerId.toUpperCase()}_API_KEY`;
  if (!process.env[envKey]) {
    process.env[envKey] = agentConfig.apiKey;
  }
  return `${agentConfig.providerId}/${agentConfig.modelId}`;
}
```

**3. Replace ALL `new MastraAgent({ model: { ... } })` calls:**

Current (broken):
```ts
const planner = new MastraAgent({
  id: 'research-planner',
  name: 'Research Planner',
  instructions: `...`,
  model: {
    providerId: agentConfig.providerId,
    modelId: agentConfig.modelId,
    apiKey: agentConfig.apiKey,
  },
});
```

Fixed:
```ts
const modelStr = setupProviderEnv(agentConfig);
const planner = new MastraAgent({
  id: 'research-planner',
  name: 'Research Planner',
  instructions: `...`,
  model: modelStr,
});
```

Do this for ALL agent instantiations in the file:
- `research-planner` (in `_plannerStep`)
- `researcher-N` (in `_researchStep`, inside the `.map()`)
- `synthesizer` (in `_synthesisStep`)

**4. Fix `agent.generate()` call** — Mastra v1.8 returns `{ text }` from `generate()`:
```ts
// Current (may work but verify):
const response = await planner.generate([...]);
const text = response.text;  // ← this should be correct

// Make sure JSON parsing handles the actual response format
```

---

## Testing

After the fix, verify:

```bash
cd /tmp/af-e2e-final/final-test
OPENAI_API_KEY="sk-proj-REDACTED" \
  agentforge research "What is Mastra.ai?" --depth shallow

# Expected output:
# ✔ Research complete!
#   Generated 3 research questions
#   Collected 3 findings
#   Synthesized comprehensive report
# [report written to research-TIMESTAMP.md]
# [markdown report printed to stdout]
```

---

## SpecSafe Checklist
- [ ] `pnpm --filter @agentforge-ai/core test` — all tests pass
- [ ] `pnpm --filter @agentforge-ai/core run typecheck` — 0 errors
- [ ] `agentforge research "test topic" --depth shallow` — completes and prints report
- [ ] Report file written to disk (`research-*.md`)
- [ ] Error case: missing API key shows clear error message

---

## Branch
`fix/spec-025-research-orchestrator`

## Notes
- Do NOT touch `convex/lib/research.ts` — that's a separate file used by the dashboard  
- Do NOT change the CLI command interface in `packages/cli/src/commands/research.ts`
- Only fix `packages/core/src/research/orchestrator.ts`
- Run `pnpm install` from repo root before working
