# SPEC-017 — Mastra Native Workspace + @mastra/s3 Integration

**Created:** 2026-03-04
**Status:** SPEC → TEST (Ready for test writing)
**Priority:** P0 — Core infrastructure improvement
**Type:** Feature enhancement

---

## Summary

Replace custom `AgentForgeWorkspace` and `R2WorkspaceProvider` with Mastra's native `Workspace` class from `@mastra/core/workspace` and `S3Filesystem` from `@mastra/s3`. This provides official support, better documentation, and automatic file tool injection for agents.

---

## Background

### Current State
- Custom `AgentForgeWorkspace` class in `packages/core/src/workspace.ts`
- Custom `R2WorkspaceProvider` in `packages/core/src/r2-provider.ts`
- Manual file tool management
- Inconsistent with Mastra's official patterns

### Why This Change
- **Official Support**: Use `@mastra/core`'s native Workspace implementation
- **Better Documentation**: Mastra docs cover Workspace patterns
- **Automatic Tools**: Agents get file tools automatically when workspace is passed
- **S3/R2 Support**: Use `@mastra/s3` for cloud storage
- **Deprecation**: Custom implementations become maintenance burden

---

## Requirements

### 1. Add @mastra/s3 Dependency
- **Location**: `packages/core/package.json`
- **Version**: `^0.2.1`
- **Command**: `cd packages/core && pnpm add @mastra/s3`

### 2. Create Workspace Factory
- **Location**: `packages/core/src/workspace/index.ts`
- **Export**: `createWorkspace(config?: WorkspaceConfig): Workspace`

```typescript
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import { S3Filesystem } from "@mastra/s3";

export interface WorkspaceConfig {
  storage?: "local" | "s3" | "r2";
  basePath?: string;
  skillsPath?: string;

  // S3/R2 config
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export function createWorkspace(config: WorkspaceConfig = {}): Workspace {
  const storage = config.storage ?? process.env.AGENTFORGE_STORAGE ?? "local";
  const skillsPaths = config.skillsPath ? [config.skillsPath] : ["/skills"];

  if (storage === "local") {
    return new Workspace({
      filesystem: new LocalFilesystem({
        basePath: config.basePath ?? "./workspace"
      }),
      skills: skillsPaths
    });
  }

  return new Workspace({
    filesystem: new S3Filesystem({
      bucket: config.bucket ?? "",
      region: storage === "r2"
        ? "auto"
        : (config.region ?? "us-east-1"),
      endpoint: config.endpoint,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }),
    skills: skillsPaths
  });
}
```

### 3. Update Agent Configuration
- **Location**: `packages/core/src/agent.ts`
- **Change**: Add `workspace?: Workspace` to `AgentConfig` interface
- **Change**: Pass `workspace` to `MastraAgent` constructor

```typescript
import { Workspace } from "@mastra/core/workspace";

export interface AgentConfig {
  // ... existing properties
  workspace?: Workspace;
}

// In Agent class constructor:
new MastraAgent({
  // ... existing args
  workspace: config.workspace, // Pass workspace to Mastra
})
```

### 4. Deprecate Custom Implementations
- **Location**: `packages/core/src/workspace.ts` — `AgentForgeWorkspace` class
- **Location**: `packages/core/src/r2-provider.ts` — `R2WorkspaceProvider` class
- **Action**: Add `@deprecated` JSDoc comments
- **Note**: Keep code functional, just mark as deprecated

```typescript
/**
 * @deprecated Use createWorkspace() from @mastra/core/workspace instead.
 * This custom implementation will be removed in a future version.
 */
export class AgentForgeWorkspace { ... }
```

### 5. CLI Workspace Commands
- **Location**: `packages/cli/src/commands/workspace.ts` (new file)
- **Commands**:
  - `agentforge workspace status` — Show current workspace config
  - `agentforge workspace ls [path]` — List workspace contents
  - `agentforge workspace read <path>` — Read file from workspace
  - `agentforge workspace init --type <local|s3|r2> --path <path>` — Initialize workspace

- **Registration**: Add to `packages/cli/src/index.ts`

```typescript
// workspace.ts
import { createWorkspace } from "@agentforge/core/workspace";

export const workspace = new Command()
  .name("workspace")
  .description("Manage AgentForge workspace storage")

  .command("status")
  .description("Show workspace configuration")
  .action(async () => {
    const config = await loadConfig();
    console.log(`Storage: ${config.storage ?? "local"}`);
    console.log(`Path: ${config.basePath ?? "./workspace"}`);
  })

  .command("ls [path]")
  .description("List workspace directory")
  .action(async (_, path = "/") => {
    const workspace = createWorkspace(await loadConfig());
    const contents = await workspace.list(path);
    console.log(contents);
  })
  // ... read, init subcommands
```

### 6. Configuration Template
- **Location**: `packages/cli/templates/default/agentforge.config.ts`
- **Content**: Add workspace configuration block

```typescript
export default defineConfig({
  // ... existing config

  workspace: {
    // storage: "local", // or "s3" or "r2"
    // basePath: "./workspace",
    // skillsPath: "/skills",

    // For S3/R2:
    // bucket: process.env.S3_BUCKET,
    // region: "us-east-1", // or "auto" for R2
    // endpoint: process.env.S3_ENDPOINT, // Required for R2
    // accessKeyId: process.env.S3_ACCESS_KEY_ID,
    // secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
```

### 7. Dashboard Workspace Tab
- **Location 1**: `packages/web/app/routes/settings.tsx`
- **Location 2**: `packages/cli/templates/default/dashboard/app/routes/settings.tsx`
- **Action**: Add "Workspace" tab showing:
  - Storage type badge (local/s3/r2)
  - Base path or bucket name
  - Skills path
  - Connection status (for S3/R2)

### 8. Template Sync
- **Action**: `cp -r packages/cli/templates/default/. packages/cli/dist/default/.`
- **Rebuild**: `cd packages/cli && pnpm run build`

### 9. Tests
- **Location**: `packages/core/src/workspace/index.test.ts`
- **Coverage**:
  - `createWorkspace()` with local storage
  - `createWorkspace()` with S3 config
  - `createWorkspace()` with R2 config (region: "auto")
  - Workspace methods: `list()`, `read()`, `write()`
  - Agent receives workspace property

### 10. Commit & PR
- **Branch**: `feat/mastra-workspace-native` (already exists)
- **Commit Message**:
  ```
  feat(workspace): Mastra-native Workspace + LocalFilesystem + @mastra/s3 (SPEC-017)

  - createWorkspace() returns native Mastra Workspace with LocalFilesystem/S3Filesystem
  - Add @mastra/s3 for S3/R2 support (replaces custom R2WorkspaceProvider)
  - Agent now accepts workspace property passed to MastraAgent
  - Skills path configured via workspace.skills
  - CLI: agentforge workspace status/ls/read/init
  - Dashboard: Workspace tab in settings
  ```

---

## Implementation Steps (In Order)

1. ✓ **SPEC** — This document
2. **TEST** — Write tests in `packages/core/src/workspace/index.test.ts`
3. **CODE** — Implementation:
   a. Add `@mastra/s3` dependency
   b. Create `workspace/index.ts` factory
   c. Update `agent.ts` for workspace support
   d. Mark old implementations as deprecated
   e. Add CLI workspace commands
   f. Create config template
   g. Add dashboard Workspace tab
   h. Sync templates and rebuild
4. **QA** — Run tests, TypeScript check, live deployment test
5. **COMPLETE** — Commit + push + PR + notify

---

## Success Criteria

- [ ] `pnpm test` — all tests pass
- [ ] `pnpm typecheck` — no TypeScript errors
- [ ] `agentforge workspace status` — displays correct config
- [ ] `agentforge workspace ls /` — lists workspace contents
- [ ] Agent with workspace config gets file tools
- [ ] Dashboard Workspace tab displays correctly
- [ ] Live test on `watchful-chipmunk-946.convex.cloud`
- [ ] PR created with all changes

---

## References

- Mastra Workspace: https://mastra.ai/docs/workspace/overview
- Mastra Filesystem: https://mastra.ai/docs/workspace/filesystem
- Mastra S3/R2: https://mastra.ai/reference/workspace/s3-filesystem
- @mastra/s3 package: https://www.npmjs.com/package/@mastra/s3
