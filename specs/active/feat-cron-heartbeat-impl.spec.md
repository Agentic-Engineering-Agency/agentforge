# feat-cron-heartbeat-impl

**Status:** CODE
**Issue:** AGE-143
**Branch:** feat/cron-heartbeat-impl
**Created:** 2026-02-26

## Summary
Implement real cron next-run calculation using cron-parser library and enable heartbeat task execution via Mastra. Replaces hardcoded "+1 hour" stubs with proper cron expression parsing and adds a new "use node" action file for heartbeat task execution that calls Mastra's generateResponse with agent's stored API key and model.

## Requirements

### A. Cron next-run calculation (convex/cronJobs.ts)
1. **cron-parser dependency**
   - Added to package.json dependencies in both dist/default/package.json and templates/default/package.json
   - Version: "^4.9.0"

2. **calculateNextRun helper function**
   - Exported function at top of cronJobs.ts (after imports)
   - Accepts: `schedule: string` (cron expression)
   - Returns: `number` (next run timestamp in milliseconds)
   - Uses `parseExpression(schedule, { utc: true })` from cron-parser
   - Falls back to `Date.now() + 60 * 60 * 1000` on invalid expression
   - Present in both dist/default/convex/cronJobs.ts and templates/default/convex/cronJobs.ts

3. **create mutation update**
   - Replaces TODO stub at line 81-83
   - Uses: `const nextRun = calculateNextRun(args.schedule);`
   - Removes: hardcoded `const nextRun = now + 60 * 60 * 1000;`

4. **update mutation update**
   - Replaces hardcoded nextRun in spread at line 112
   - Uses: `{...(updates.schedule ? { nextRun: calculateNextRun(updates.schedule) } : {})}`

### B. Heartbeat task execution via Mastra
1. **heartbeatActions.ts creation**
   - New file at both dist/default/convex/heartbeatActions.ts and templates/default/convex/heartbeatActions.ts
   - First line: `"use node";` (required for Node.js runtime)
   - Contains ONLY internalAction functions (no queries, mutations, or regular actions)
   - Exports: `executeTask` internalAction

2. **executeTask action**
   - Args: `agentId: string`, `task: string`, `threadId: optional(id("threads"))`
   - Returns: `{ success: boolean; response?: string; error?: string }`
   - Loads agent config via `api.agents.get`
   - Extracts provider and model from agent (with defaults: "openai", "gpt-4o-mini")
   - Calls `internal.mastraIntegration.generateResponse` with:
     - `provider` from agent
     - `modelKey: ${provider}/${modelId}`
     - `instructions` from agent (with default)
     - `messages: [{ role: "user", content: task }]`
   - Returns success with response text or error message

3. **heartbeat.ts processCheck update**
   - Imports `internal` from "./_generated/api" (added to existing import)
   - Replaces TODO console.log stub at lines 326-328
   - Loops through pendingTasks array
   - For each task:
     - Calls `internal.heartbeatActions.executeTask`
     - On success: calls `api.heartbeat.removePendingTask`
     - On failure: logs error with `[heartbeat]` prefix
   - Tracks `executedCount` of successful executions
   - After loop: if `executedCount > 0`, calls `updateStatus` with status "idle" and undefined currentTask
   - Updates return value: `pendingTasks: heartbeat.pendingTasks.length - executedCount`
   - Updates return value: `status: executedCount > 0 ? "idle" : heartbeat.status`

### C. Sync between dist and templates
1. **dist/default vs templates/default**
   - package.json must be identical (both have cron-parser)
   - cronJobs.ts must be identical
   - heartbeat.ts must be identical
   - heartbeatActions.ts must be identical

## Test Plan

### Unit tests (packages/cli/tests/unit/cron-heartbeat.test.ts)
1. **calculateNextRun with standard cron expression**
   - Test: "0 9 * * *" (daily at 9am)
   - Assert: Returns timestamp > Date.now()
   - Assert: Returns timestamp < Date.now() + 48 hours

2. **calculateNextRun with interval expression**
   - Test: "*/5 * * * *" (every 5 minutes)
   - Assert: Returns timestamp within 5 minutes from now

3. **calculateNextRun with invalid expression**
   - Test: "invalid-cron"
   - Assert: Returns timestamp ≈ 1 hour from now (within 1 second margin)
   - Assert: Returns timestamp > Date.now()

4. **cron-parser import verification**
   - Test: Import calculateNextRun from cronJobs
   - Assert: Function is defined

5. **heartbeatActions.executeTask structure**
   - Test: Verify executeTask is exported
   - Assert: Function exists

6. **processCheck behavior (integration test)**
   - Test: Mock heartbeat with pendingTasks
   - Assert: executeTask is called for each task
   - Assert: removePendingTask is called on success

### Verification tests
- pnpm install succeeds (cron-parser installed)
- pnpm build passes
- pnpm test passes (82+ tests, all green)
- No TODO comments remain in cronJobs.ts or heartbeat.ts
- heartbeatActions.ts has "use node" as first line
- heartbeatActions.ts contains ONLY action functions
- heartbeat.ts does NOT have "use node"
- diff -rq dist/default/ templates/default/ → no differences
- pnpm audit → 0 vulnerabilities

## Non-Goals
- Not changing cron job execution trigger (still external)
- Not adding new heartbeat statuses
- Not modifying cronJobs schema
- Not changing mastraIntegration.ts
