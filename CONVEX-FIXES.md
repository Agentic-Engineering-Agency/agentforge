# Convex Bundling Fixes - Summary

## Problem
The Convex deployment was failing with bundling errors related to `@mastra/core` packages that have deep Node.js built-in dependencies (crypto, fs, stream, etc.). The Convex bundler couldn't handle these dependencies properly.

## Solution
Replaced `@mastra/core` imports with direct AI SDK usage and split files into Node.js and non-Node.js runtime components.

## Changes Made

### 1. Created Local Agent Implementation
**File: `convex/lib/agent.ts`**
- New minimal Agent class using Vercel AI SDK directly
- Provides `stream()` and `generate()` methods
- Includes `getBaseModelId()` and `getProviderBaseUrl()` helpers
- Avoids the `@mastra/core` dependency entirely

### 2. Created Local Pipeline Implementation
**File: `convex/lib/pipeline.ts`**
- Copied `AgentPipeline` class from `@agentforge-ai/core`
- Pure TypeScript with no Node.js dependencies
- Used by `convex/workflowEngine.ts`

### 3. Split Chat Functions
**File: `convex/chatMutations.ts` (new)**
- Moved mutations: `createThread`, `addUserMessage`, `addAssistantMessage`
- Moved queries: `getThreadMessages`, `listThreads`
- Runs in default Convex runtime (no `"use node"`)

**File: `convex/chat.ts` (modified)**
- Kept only actions: `sendMessage`, `startNewChat`
- Uses `"use node"` directive
- Imports Agent from `./lib/agent` instead of `@mastra/core/agent`

### 4. Split Memory Consolidation Functions
**File: `convex/memoryConsolidationMutations.ts` (new)**
- Moved internal mutations: `bulkRemoveMemories`, `insertConsolidationRecord`
- Moved queries: `listConversationMemoriesForConsolidation`
- Moved public functions: `cleanupExpired`, `getConsolidationHistory`
- Runs in default Convex runtime

**File: `convex/memoryConsolidation.ts` (modified)**
- Kept only action: `consolidate`
- Uses `"use node"` directive
- Imports Agent from `./lib/agent` instead of `@mastra/core/agent`

### 5. Disabled Features with Deep Dependencies
**File: `convex/research.ts` (modified)**
- `start()` action now throws "temporarily disabled" error
- `ResearchOrchestrator` has deep Node.js dependencies
- Will be re-enabled with custom implementation

**File: `convex/http.ts` (modified)**
- `/api/voice/synthesize` endpoint now returns 501 "temporarily disabled"
- `ElevenLabsTTS` has deep Node.js dependencies
- Will be re-enabled with custom implementation

**File: `convex/lib/workflowEngine.ts` (modified)**
- Exported functions throw "temporarily disabled" errors
- `createWorkflow`, `createStep` from `@mastra/core/workflows` have deep dependencies
- Use `convex/workflowEngine.ts` instead which uses local `AgentPipeline`

### 6. Updated Imports
**Files modified to use local agent:**
- `convex/mastraIntegration.ts`: `import { Agent } from "./lib/agent"`
- `convex/chat.ts`: `import { Agent } from "./lib/agent"`
- `convex/memoryConsolidation.ts`: `import { Agent } from "./lib/agent"`
- `convex/workflowEngine.ts`: `import { Agent, ... } from "./lib/agent"`
- `convex/http.ts`: `import { Agent, ... } from "./lib/agent"`

### 7. Configuration Changes
**File: `convex.json` (new)**
- Created Convex configuration file
- Set `externalPackages: []` (no longer needed since we use AI SDK directly)

**File: `package.json` (modified)**
- Replaced `@mastra/core` with `ai` and `@ai-sdk/openai-compatible`
- Removed `@agentforge-ai/core` and `@modelcontextprotocol/sdk` from root

## Result
✅ Convex deployment successful
✅ Core chat functionality works
✅ Agent execution works
✅ Workflow execution works (using local AgentPipeline)

## Temporarily Disabled
- Research orchestration (`ResearchOrchestrator`)
- TTS synthesis (`ElevenLabsTTS`)
- Mastra workflow engine (`createWorkflow`, `createStep`)

## Next Steps
1. Re-enable ResearchOrchestrator with custom implementation
2. Re-enable TTS with direct ElevenLabs API integration
3. Replace Mastra workflow engine with custom implementation
4. Add model fetching actions (models:fetchAndCacheModels)
