# fix-byok-mastra-native

**Status:** QA
**Issue:** AGE-142
**Branch:** fix/byok-mastra-native
**Created:** 2026-02-26

## Summary
Fix BYOK (Bring Your Own Key) API key injection for Mastra 1.8.0 router compatibility. Mastra's internal router reads `process.env` for API keys and ignores AI SDK model instances passed to Agent constructor. Fix injects decrypted keys into `process.env` before creating Mastra Agent, uses Mastra-native model string format (`provider/modelId`). Also fixes dashboard TypeScript config.

## Requirements

### A. BYOK process.env injection (convex/mastraIntegration.ts)
1. **getProviderEnvKey function** — Map provider names to env var names
   - Maps: openai→OPENAI_API_KEY, anthropic→ANTHROPIC_API_KEY, google→GOOGLE_GENERATIVE_AI_API_KEY
   - Maps: xai→XAI_API_KEY, mistral→MISTRAL_API_KEY, deepseek→DEEPSEEK_API_KEY, openrouter→OPENROUTER_API_KEY
   - Fallback: provider uppercase with dashes replaced by underscores + _API_KEY suffix
   - Function must be present in both dist/default/convex/mastraIntegration.ts and templates/default/convex/mastraIntegration.ts

2. **executeAgent function fix** — Inject key before Agent creation
   - Line after apiKey fetch: `process.env[getProviderEnvKey(provider)] = apiKey;`
   - Model format: `const mastraModel = \`${provider}/${modelId}\`;`
   - Agent creation uses: `model: mastraModel` (NOT resolvedModel instance)
   - No MessageListInput cast on generate() call

3. **generateResponse function fix** — Same pattern
   - Line after apiKey fetch: `process.env[getProviderEnvKey(args.provider)] = apiKey;`
   - Model format: `const mastraModel = \`${args.provider}/${args.modelKey}\`;`
   - Agent creation uses: `model: mastraModel`
   - No MessageListInput cast on generate() call

### B. Remove @ai-sdk/* imports (convex/mastraIntegration.ts)
1. **Removed imports**
   - No `import { createOpenAI } from "@ai-sdk/openai";`
   - No `import { createAnthropic } from "@ai-sdk/anthropic";`
   - No `import { createGoogleGenerativeAI } from "@ai-sdk/google";`
   - No `import { createXai } from "@ai-sdk/xai";`
   - No `import type { MessageListInput } from "@mastra/core/agent";`

2. **Removed function**
   - No `createModelWithApiKey` function (replaced by getProviderEnvKey)

3. **package.json cleanup**
   - No @ai-sdk/anthropic in dependencies
   - No @ai-sdk/google in dependencies
   - No @ai-sdk/xai in dependencies
   - No @ai-sdk/openai in dependencies (nothing uses it)

### C. Dashboard TypeScript fixes
1. **dashboard/tsconfig.json**
   - Has `"types": ["vite/client"]` in compilerOptions
   - Present in both dist/default/dashboard/tsconfig.json and templates/default/dashboard/tsconfig.json

2. **dashboard/app/main.tsx**
   - Uses `import.meta.env.VITE_CONVEX_URL` (no `as any` cast)
   - Present in both locations

### D. Sync between dist and templates
1. **dist/default vs templates/default**
   - mastraIntegration.ts must be identical in both
   - package.json must be identical in both
   - dashboard/tsconfig.json must be identical in both
   - dashboard/app/main.tsx must be identical in both

## Test Plan
- grep createOpenAI dist/default/convex/mastraIntegration.ts → zero results
- grep createAnthropic dist/default/convex/mastraIntegration.ts → zero results
- grep createGoogleGenerativeAI dist/default/convex/mastraIntegration.ts → zero results
- grep createXai dist/default/convex/mastraIntegration.ts → zero results
- grep MessageListInput dist/default/convex/mastraIntegration.ts → zero results
- grep "as any" dist/default/dashboard/app/main.tsx → zero results
- grep "@ai-sdk/" dist/default/package.json → zero results
- diff -rq dist/default/ templates/default/ → no differences
- pnpm build passes
- pnpm test passes (82/82 tests)

## Non-Goals
- Not changing Mastra version
- Not modifying Convex schema
- Not adding new provider support
