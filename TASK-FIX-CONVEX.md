# TASK: Fix 32 Convex TypeScript Errors

Run `npx convex dev --once` to see all errors. Fix ALL of them so it completes with 0 errors.

## Error Categories

### 1. Missing `internal` import in `convex/apiKeys.ts` (lines 104, 137, 197, 204)
Add: `import { internal } from "./_generated/api";`

### 2. Mutations calling `ctx.runAction` — CONVEX VIOLATION (apiKeys.ts:104, 137)
Convex mutations CANNOT call actions. The `create` and `update` mutations call `ctx.runAction(internal.apiKeysCrypto.encryptApiKey, ...)`.

**Fix:** Convert `create` and `update` to **actions** that:
1. Call the crypto action to encrypt
2. Call an internal mutation to store the data

You'll need to create `createInternal` and `updateInternal` as `internalMutation`s for the DB operations, then make `create` and `update` actions that orchestrate encrypt + store.

BUT: also check if the dashboard/CLI imports these — if they use `api.apiKeys.create`, it needs to stay exported as `create` (just change from `mutation` to `action`).

### 3. `apiKeysCrypto.ts:28` — `hkdfSync` returns `ArrayBuffer`, not `Buffer`
Fix: `return Buffer.from(crypto.hkdfSync(...));`

### 4. Callers using `ctx.runQuery` for an action (10 files)
`getDecryptedForProvider` is an `internalAction`, not a query. All callers that do `ctx.runQuery(internal.apiKeys.getDecryptedForProvider, ...)` must use `ctx.runAction(...)` instead.

Files: chat.ts:384, cronJobs.ts:402, http.ts:316, http.ts:448, mastraIntegration.ts:354, modelFetcher.ts:345, modelFetcher.ts:369, models.ts:158, researchActions.ts:49, workflowEngine.ts:83

**IMPORTANT:** Only **actions** can call other actions. If any of these callers are queries or mutations, they need to become actions first, OR the architecture needs restructuring.

### 5. `models.ts:198` — `internal.models` doesn't exist
Should be `internal.modelsActions.fetchForProvider` or similar. Check what's exported from `convex/modelsActions.ts`.

### 6. `modelsActions.ts:105` — `api` not imported
Add: `import { api } from "./_generated/api";`

### 7. `researchActions.ts` — `internal.researchMutations` not found (5 errors)
The generated `internal` type doesn't include `researchMutations`. Check if the file is named correctly and exports are right. Might need to regenerate: `npx convex codegen`.

### 8. `researchMutations.ts` — Query chaining type error (4 errors, lines 37-43)
`query = query.withIndex(...)` — the type narrows after first `.withIndex()`. Fix by restructuring the conditional query building (use separate branches or cast).

### 9. `telegramWebhook.ts:22` — `ctx.runMutation` on a query
`getDecryptedBotToken` is a query, not a mutation. Change to `ctx.runQuery(...)`.

### 10. `memoryConsolidation.ts` — Multiple errors (4)
- Line 73: Missing `id` property in Agent constructor
- Line 89: Implicit `any` parameter
- Line 96: Wrong argument count
- Line 115: Implicit `any` parameter

## Validation
After fixing, run:
```bash
npx convex dev --once 2>&1
# Must show 0 errors
pnpm test 2>&1
# Must still pass all 757 tests
```

## Rules
- Do NOT change the public API surface if avoidable
- Keep "use node" directive on files that need Node.js
- Maintain the security model: no decrypted keys in queries/mutations, only in actions
- `internal` functions are not client-accessible
