# Mastra Analysis: Configuration, Vercel Compatibility, and Workflows

**Analyst:** Teammate 1 (Mastra Analyst)
**Date:** 2026-02-20
**Repos:**
- Framework: `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge`
- Cloud App: `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud`
**Focus:** Improvement points 1, 2, and 6 — Mastra version/config, Vercel+Mastra schema compatibility, Mastra Workflows

---

## Task 1: Verify Mastra & Vercel Schema Compatibility

### Deployment Architecture

The `agentforge-cloud` repo does **NOT** use Vercel. There are **no `vercel.json` files** in either repo.

The cloud app deploys to:
- **Frontend (dashboard + landing):** Cloudflare Pages via Wrangler
- **API:** Cloudflare Workers via Wrangler (`apps/api/wrangler.toml`)
- **Backend:** Convex (serverless data platform)

```json
// agentforge-cloud/package.json (deploy scripts)
"deploy:dashboard": "pnpm dlx wrangler@4.62.0 pages deploy apps/dashboard/dist --project-name agentforge-cloud-dashboard",
"deploy:landing": "pnpm dlx wrangler@4.62.0 pages deploy apps/landing/dist --project-name agentforge-cloud"
```

### Next.js Check

- `apps/dashboard` is a **Vite + React + TanStack Router SPA** — no Next.js, no `next.config.*`
- `apps/landing` is also a **Vite + React SPA** — no Next.js

### Mastra's Vercel Deployer

Mastra's `VercelDeployer` (from `@mastra/deployer-vercel`) applies only when deploying a **standalone Mastra HTTP server** to Vercel. It generates a `vercel.json` and `index.mjs` for `@vercel/node` builds. This pattern is entirely irrelevant to the AgentForge stack. Mastra here runs **inside Convex Node Actions** — not as a separate HTTP server.

The required `next.config.ts` setting from Mastra docs:
```typescript
// Only needed for Next.js apps using Mastra
const nextConfig = { serverExternalPackages: ["@mastra/*"] };
```
...is **not needed** here since neither app is Next.js.

### Compatibility Verdict

| Check | Status |
|---|---|
| `vercel.json` present | Not present — not applicable (Cloudflare Pages deployment) |
| `next.config.*` with `serverExternalPackages` | Not needed — no Next.js in stack |
| `@mastra/deployer-vercel` usage | Not used / not needed |
| Mastra inside Convex Node Actions | Present and correct in `convex/mastra.ts` |
| `convex.config.ts` registers Mastra component | Present — `app.use(mastra)` from `@convex-dev/mastra/convex.config` |

**Conclusion:** There are no Vercel vs. Mastra compatibility conflicts because the stack does not use Vercel for backend. Mastra running inside Convex Node Actions is the correct and supported pattern for this stack.

---

## Task 2: Verify Mastra Configuration Against Latest Docs

### Version Summary

| Package Location | `@mastra/core` Declared | Notes |
|---|---|---|
| `agentforge/packages/core/package.json` | `^1.4.0` | Framework core — installed at 1.4.0 |
| `agentforge/packages/convex-adapter/package.json` | `^1.4.0` | Convex adapter |
| `agentforge-cloud/package.json` (root) | `0.8.3` (exact pin) | **Severely outdated** |
| `agentforge-cloud/convex/package.json` | `^0.10.4` | **Severely outdated** |
| `@convex-dev/mastra` in cloud root | `https://pkg.pr.new/get-convex/mastra/@convex-dev/mastra@6` | **PR preview URL — not stable** |
| `@convex-dev/mastra` in `convex/package.json` | `^0.0.4` | Very old range |

**Key version problem:** The `agentforge-cloud` root `package.json` pins `@mastra/core` at `0.8.3`. The cloud's `convex/package.json` uses `^0.10.4`. Both are severely behind the framework packages (1.4.0) and the latest npm release (1.4.x/1.5.x). The `convex/mastra.ts` code is clearly written against 1.x APIs (e.g., `from "@mastra/core/mastra"`, `ConvexStorage`) but the package.json files declare 0.x versions.

### Docs-Recommended Setup Pattern (from mastra.ai/docs/getting-started/manual-install)

The docs recommend:

1. **Project structure:**
   - `src/mastra/tools/` for tool definitions
   - `src/mastra/agents/` for agent configurations
   - `src/mastra/index.ts` as main Mastra entry point

2. **Core imports:**
   ```typescript
   import { createTool } from "@mastra/core/tools";
   import { Agent } from "@mastra/core/agent";
   import { Mastra } from "@mastra/core";
   ```

3. **TypeScript:** `"target": "ES2022"`, `"moduleResolution": "bundler"` — both present in `convex/tsconfig.json`

4. **Scripts:** `"dev": "mastra dev"`, `"build": "mastra build"` for Mastra Studio integration

5. **Agent registration:** Agents registered in `new Mastra({ agents: { agentName: agentInstance }, ... })`

6. **Workflow registration:** Workflows registered in `new Mastra({ workflows: { ... } })`

### Current Configuration Analysis

#### agentforge (framework) — `packages/core/src/mastra.ts`

```typescript
// File: packages/core/src/mastra.ts (lines 1-2)
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core";

// createMastraAgent (lines 79-96) — passes `id` field to Agent constructor
export function createMastraAgent(config: AgentForgeAgentConfig): Agent {
  return new Agent({
    id: config.id,   // The `id` field may be deprecated in newer versions
    name: config.name,
    instructions: config.instructions,
    model: modelString,
    tools: config.tools || {},
  });
}

// createMastraInstance (lines 101-112) — no workflows, no storage registered
export function createMastraInstance(config?): Mastra {
  const mastraConfig: any = {};
  if (config?.apiKeys) mastraConfig.apiKeys = config.apiKeys;
  return new Mastra(mastraConfig);
}
```

**Issues found:**
- `createMastraAgent()` passes `id` as a constructor field — check if this is still valid in 1.5.x (docs show `Agent({ name, instructions, model })` without `id`)
- `createMastraInstance()` creates a bare Mastra with no workflows, no storage, and no agents registered
- The `packages/core/src/mastra.ts` module is not exported from `packages/core/src/index.ts` — it's a utility file but not part of the public API. `createMastraInstance` is a dead export.

#### agentforge (framework) — `packages/core/src/agent.ts`

The core `Agent` class wraps a Mastra agent internally (`packages/core/src/agent.ts:117`) and is the primary abstraction. This is well-structured but does not expose any Mastra workflows API. Tool support is via `MCPServer`, not Mastra's `createTool` pattern.

#### agentforge-cloud — `convex/mastra.ts`

```typescript
// File: convex/mastra.ts (lines 20, 27-34, 129-136)
import { Mastra } from "@mastra/core/mastra";
import { ConvexStorage } from "@convex-dev/mastra";

export const storage = new ConvexStorage(components.mastra);  // Good — correct storage pattern

export function getMastra(): Mastra {
  _mastra = new Mastra({
    agents: {},  // Empty — no agents registered
    storage,
  });
  return _mastra;
}
```

**Issues found:**

1. **`require()` for `@mastra/core/agent` inside ESM functions (lines 178, 215):** The `createUtilityAgent()` and `createAgentFromConfig()` functions use `require("@mastra/core/agent")` inside ESM module functions. This is inconsistent with the top-level `import { Mastra } from "@mastra/core/mastra"`. While Convex Node actions support CommonJS require, mixing ESM imports and CommonJS require is fragile and may break on future Convex runtime changes.

   ```typescript
   // convex/mastra.ts:178 — problematic
   export function createUtilityAgent(instructions: string) {
     const { Agent } = require("@mastra/core/agent");  // CommonJS require in ESM context
     ...
   }
   ```

2. **Semi-private `__registerMastra()` and `__registerPrimitives()` APIs (lines 191-194, 226-229):**
   ```typescript
   agent.__registerMastra(mastra);
   agent.__registerPrimitives({
     logger: mastra.getLogger(),
     storage: mastra.getStorage(),
   });
   ```
   These double-underscore methods are internal Mastra APIs not documented in the public interface. They may change without warning in minor versions.

3. **Deprecated functions preserved (lines 163-266):** `createAgentFromConfig()` and `createAgentFromRecord()` are marked `@deprecated` but remain in the file. `createUtilityAgent()` still uses the deprecated pattern. The migration comment says to use `ConvexAgent` from `@agentforge-ai/convex-adapter`, but `createUtilityAgent()` has not been migrated.

4. **`agents: {}` in Mastra constructor (line 132):** The `getMastra()` singleton initializes with an empty `agents` object. Docs recommend registering actual agents in the `Mastra` constructor for Studio integration and proper observability routing. With empty agents, the Mastra instance only serves as a storage holder.

5. **`@ts-ignore` for `components.mastra` (lines 26, 33):** Two `@ts-ignore` comments suppress type errors for `components.mastra`. This is expected before `convex codegen` runs, but suggests the generated types are not being committed or checked in. After codegen, these `@ts-ignore` comments should be removable.

### Configuration Comparison Table

| Docs-Recommended Pattern | agentforge-cloud Status |
|---|---|
| `new Mastra({ agents: { name: instance } })` | Not followed — `agents: {}` empty |
| `new Mastra({ workflows: { ... } })` | Not implemented — no workflows |
| Import from `@mastra/core/agent` (ESM) | Mixed: top-level ESM import + `require()` inside functions |
| Pin to stable npm release | `@convex-dev/mastra` pinned to PR preview URL |
| `mastra dev` / `mastra build` scripts | Not applicable (Convex deployment model) |
| Storage configured via `ConvexStorage` | Correctly implemented |
| `convex.config.ts` uses `@convex-dev/mastra/convex.config` | Correctly implemented |

---

## Task 3: Investigate Mastra Workflows

### Search Results — Both Repos

Exhaustive search for `createWorkflow`, `createStep`, `from "@mastra/core/workflows"`, and workflow-named files across both repos:

| Location | Workflow Code Found |
|---|---|
| `agentforge/packages/core/src/` | **None** |
| `agentforge/packages/convex-adapter/src/` | **None** |
| `agentforge/convex/mastraIntegration.ts` | Placeholder stub only |
| `agentforge/packages/cli/templates/default/convex/mastraIntegration.ts` | Placeholder stub only |
| `agentforge-cloud/convex/` | **None** |
| `agentforge-cloud/apps/` | **None** |

### The Only Workflow "Code" — A Placeholder Stub

Both `agentforge/convex/mastraIntegration.ts:417-429` and the CLI template at `packages/cli/templates/default/convex/mastraIntegration.ts:269-281` contain an identical stub:

```typescript
// convex/mastraIntegration.ts (lines 417-429)
export const executeWorkflow = action({
  args: {
    workflowId: v.string(),
    input: v.any(),
    userId: v.optional(v.string()),
  },
  handler: async (_ctx, _args): Promise<{ success: boolean; message: string }> => {
    return {
      success: true,
      message: "Workflow execution coming soon",
    };
  },
});
```

This action exists in the public API surface but does nothing. It will be scaffolded into every new project created via the CLI.

### Dashboard UI — No Workflow Routes

The `agentforge-cloud/apps/dashboard` has no workflow management UI. Current dashboard routes include: projects, agents, API keys, billing, settings, organizations — but no `/workflows`.

### Mastra Workflow API (Available in 1.4.0, Unused)

The installed `@mastra/core@1.4.0` in agentforge's node_modules includes full workflow support:
- `createWorkflow` and `createStep` from `@mastra/core/workflows`
- `Workflow` and `AnyWorkflow` types (confirmed in `@mastra/core/dist/mastra/index.d.ts:26`)
- Sequential composition with `.then()`
- Parallel execution, conditional branching
- Human-in-the-loop via `suspend()` and `resumeSchema`
- Registration via `new Mastra({ workflows: { myWorkflow } })`

**None of these APIs are used anywhere in either codebase.**

### What Would Mastra Workflows Look Like Here?

Per the Mastra docs (workflows/overview), the recommended pattern for implementing a workflow is:

```typescript
// Step 1: Define steps with schemas
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  id: "step-1",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ context }) => {
    // ... agent or tool execution
    return { result: "..." };
  },
});

// Step 2: Compose workflow
const myWorkflow = createWorkflow({
  id: "my-workflow",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(step1)
  .then(step2)
  .commit();

// Step 3: Register with Mastra instance
const mastra = new Mastra({
  workflows: { myWorkflow },
  storage,
});

// Step 4: Execute in a Convex action
const run = mastra.getWorkflow("myWorkflow").createRun();
const result = await run.start({ inputData: { prompt: "..." } });
```

This integration would require:
1. Workflow definitions in `convex/` (or a separate package)
2. Registration in `getMastra()` (`convex/mastra.ts`)
3. A real Convex action replacing the `executeWorkflow` stub
4. Schema updates for workflow run state persistence
5. Dashboard UI for workflow management

---

## Issues Found — Summary

### Issue 1: Severe Version Mismatch in agentforge-cloud (HIGH)

**Files:** `agentforge-cloud/package.json:45`, `agentforge-cloud/convex/package.json:11`

- Root package pins `@mastra/core` at `0.8.3` (exact, outdated by 6+ minor versions)
- Convex package uses `^0.10.4` (range, also severely outdated)
- Code in `convex/mastra.ts` uses 1.x APIs (sub-path imports like `@mastra/core/mastra`)
- `@convex-dev/mastra` in root is pinned to a PR preview URL (`pkg.pr.new/...@6`) — not a stable release
- `@convex-dev/mastra` in `convex/package.json` uses `^0.0.4` — also outdated

**Recommendation:** Update agentforge-cloud to `@mastra/core: "^1.4.0"` in both `package.json` and `convex/package.json`. Pin `@convex-dev/mastra` to a stable npm release.

---

### Issue 2: `require()` Inside ESM Module Functions (MEDIUM)

**File:** `agentforge-cloud/convex/mastra.ts:178`, `agentforge-cloud/convex/mastra.ts:215`

The `createUtilityAgent()` and `createAgentFromConfig()` functions use CommonJS `require()` inside an ESM module (`"use node"` directive at top). While Convex Node actions can handle this, it is inconsistent with the top-level ESM imports and brittle.

**Recommendation:** Replace `const { Agent } = require("@mastra/core/agent")` with top-level ESM imports. Since both functions are deprecated, consider removing them entirely.

---

### Issue 3: Semi-Private `__registerMastra` and `__registerPrimitives` APIs (MEDIUM)

**File:** `agentforge-cloud/convex/mastra.ts:191-194`, `agentforge-cloud/convex/mastra.ts:226-229`

`createUtilityAgent()` and `createAgentFromConfig()` call `agent.__registerMastra()` and `agent.__registerPrimitives()`. These are internal APIs not part of Mastra's public interface. A Mastra version upgrade could silently break them.

**Recommendation:** Migrate to the official `Mastra({ agents: { name: agent } })` registration pattern, or remove the deprecated helper functions entirely since the codebase has already migrated to `ConvexAgent` from `@agentforge-ai/convex-adapter`.

---

### Issue 4: Deprecated Functions Not Cleaned Up (LOW)

**File:** `agentforge-cloud/convex/mastra.ts:163-266`

`createAgentFromConfig()` and `createAgentFromRecord()` are marked `@deprecated` and documented as superseded by `ConvexAgent` from `@agentforge-ai/convex-adapter`. However, `createUtilityAgent()` (not deprecated) still uses the deprecated `createAgentFromConfig()` call pattern internally. The deprecated functions remain in the exported surface area, potentially confusing future developers.

**Recommendation:** Remove deprecated functions. Rewrite `createUtilityAgent()` to use `ConvexAgent` or `ConvexAgentAdapter` directly.

---

### Issue 5: Mastra `agents: {}` Empty — No Registered Agents (LOW)

**File:** `agentforge-cloud/convex/mastra.ts:131-133`

```typescript
_mastra = new Mastra({
  agents: {},   // empty — no registered agents
  storage,
});
```

The Mastra instance exists purely as a storage holder. Agent creation bypasses the Mastra agent registry. This means the Mastra Studio integration (if ever used), observability routing, and workflow-to-agent handoff features don't function.

**Recommendation:** Register actual agent instances in the `Mastra` constructor, or document explicitly that agent registration is intentionally bypassed in favor of dynamic `ConvexAgent` creation.

---

### Issue 6: Zero Mastra Workflow Implementation (HIGH)

**Files:** Both repos — no workflow definitions exist anywhere

No `createWorkflow`, `createStep`, or `@mastra/core/workflows` imports are present in either codebase. The `executeWorkflow` Convex action is a no-op stub. No workflow management UI exists in the dashboard.

**What is needed to implement Mastra Workflows:**
1. Workflow definitions using `createStep` / `createWorkflow` from `@mastra/core/workflows`
2. Workflow registration in `getMastra()` singleton in `convex/mastra.ts`
3. A real implementation replacing the `executeWorkflow` stub in `convex/mastraIntegration.ts`
4. Convex schema tables for workflow run state (can leverage `ConvexStorage` from `@convex-dev/mastra`)
5. Dashboard route `/dashboard/workflows` for creating, monitoring, and managing workflow runs
6. API endpoint in `apps/api/src/index.ts` for external workflow triggering

---

### Issue 7: `@convex-dev/mastra` PR Preview URL Dependency (MEDIUM)

**File:** `agentforge-cloud/package.json:42`

```json
"@convex-dev/mastra": "https://pkg.pr.new/get-convex/mastra/@convex-dev/mastra@6"
```

This is a PR preview artifact URL, not a stable npm release. Such URLs may become unavailable, and the package bypasses standard version management and lockfile reproducibility.

**Recommendation:** Check if `@convex-dev/mastra` has a stable npm release and pin to it. The `convex/package.json` uses `^0.0.4` which is very old; the root should match the stable release version.

---

## Recommendations Summary

| # | Issue | Severity | Affected Files | Action |
|---|---|---|---|---|
| 1 | `@mastra/core` version mismatch in cloud | HIGH | `agentforge-cloud/package.json`, `agentforge-cloud/convex/package.json` | Update to `^1.4.0` |
| 2 | `require()` inside ESM functions | MEDIUM | `agentforge-cloud/convex/mastra.ts:178,215` | Replace with top-level ESM imports or remove deprecated fns |
| 3 | Semi-private `__registerMastra` API usage | MEDIUM | `agentforge-cloud/convex/mastra.ts:191-194,226-229` | Migrate to official registration pattern |
| 4 | Deprecated functions not removed | LOW | `agentforge-cloud/convex/mastra.ts:163-266` | Remove deprecated helpers |
| 5 | `agents: {}` empty Mastra constructor | LOW | `agentforge-cloud/convex/mastra.ts:131-133` | Register agents or document decision |
| 6 | Zero Mastra Workflow implementation | HIGH | Both repos | Implement `createWorkflow`/`createStep`, update stub action, add UI |
| 7 | `@convex-dev/mastra` PR preview URL | MEDIUM | `agentforge-cloud/package.json:42` | Pin to stable npm release |

---

## Files Inspected

### agentforge (framework)
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/package.json`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/packages/core/package.json`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/packages/core/src/mastra.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/packages/core/src/agent.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/packages/core/src/index.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/packages/convex-adapter/package.json`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/packages/convex-adapter/src/convex-agent.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/packages/convex-adapter/src/index.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/convex/mastraIntegration.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge/packages/cli/templates/default/convex/mastraIntegration.ts`

### agentforge-cloud
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/package.json`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/convex/package.json`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/convex/tsconfig.json`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/convex/mastra.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/convex/convex.config.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/convex/agentRunner.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/convex/http.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/convex/schema.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/apps/api/package.json`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/apps/api/wrangler.toml`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/apps/api/src/index.ts`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/apps/dashboard/package.json`
- `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/apps/landing/package.json`
