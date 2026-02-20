# Spec: [AF-52] Mastra Workspace Integration

**Author:** Manus AI
**Date:** 2026-02-17
**Status:** Proposed
**Mastra Version:** @mastra/core@1.1.0

## 1. Objective

Fully align AgentForge with the latest Mastra Workspace capabilities (added in `@mastra/core@1.1.0`) to provide a more robust, feature-rich, and standardized agent environment. This involves deprecating legacy implementations (e.g., standalone E2B sandbox) and adopting new features like vector search, the Agent Skills specification, native OS sandboxing, and Cloudflare R2 filesystem support.

## 2. Mastra Workspace API Summary

The Workspace class combines a filesystem and sandbox to provide agents with file storage and command execution capabilities. It also supports BM25 and vector search for indexed content.

### 2.1 Workspace Class Constructor

```typescript
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

const workspace = new Workspace({
  id: 'my-workspace',
  name: 'My Workspace',
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  bm25: true,
  vectorStore: myVectorStore,
  embedder: myEmbedder,
  autoIndexPaths: ['/docs'],
  skills: ['/skills'],
  tools: {
    enabled: true,
    requireApproval: false,
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireApproval: true },
  },
  operationTimeout: 30000,
});
```

### 2.2 Filesystem Providers

| Provider | Package | Key Config | Notes |
|---|---|---|---|
| LocalFilesystem | `@mastra/core/workspace` | `basePath`, `readOnly?` | Local disk storage |
| S3Filesystem | `@mastra/s3` | `bucket`, `region`, `endpoint?`, `prefix?` | S3-compatible (AWS, **R2**, MinIO) |
| GCSFilesystem | `@mastra/gcs` | `bucket`, `projectId?`, `credentials?` | Google Cloud Storage |

**Cloudflare R2 Pattern (critical for our stack):**
```typescript
import { S3Filesystem } from '@mastra/s3';
const r2 = new S3Filesystem({
  bucket: 'my-r2-bucket',
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
});
```

### 2.3 Sandbox Providers

| Provider | Package | Key Config | Notes |
|---|---|---|---|
| LocalSandbox | `@mastra/core/workspace` | `workingDirectory?`, `isolation?`, `allowNetwork?` | Local execution with optional OS isolation |
| E2BSandbox | `@mastra/e2b` | `apiKey?`, `timeout?`, `template?` | Cloud sandbox with FUSE mounting |

**LocalSandbox Native Isolation (new discovery):**
```typescript
const sandbox = new LocalSandbox({
  workingDirectory: './workspace',
  isolation: 'bwrap',     // 'none' | 'seatbelt' (macOS) | 'bwrap' (Linux)
  allowNetwork: false,
  readOnlyPaths: ['/etc'],
  readWritePaths: ['./workspace'],
  allowSystemBinaries: true,
});
```

**E2BSandbox Custom Templates:**
```typescript
const sandbox = new E2BSandbox({
  template: (base) => base
    .aptInstall(['ffmpeg', 'imagemagick'])
    .pipInstall(['pandas', 'numpy'])
    .npmInstall(['sharp']),
});
```

**E2BSandbox Mounting (S3/GCS only):**
```typescript
const workspace = new Workspace({
  mounts: {
    '/data': new S3Filesystem({ bucket: 'my-bucket', region: 'us-east-1' }),
    '/gcs': new GCSFilesystem({ bucket: 'my-gcs-bucket' }),
  },
  sandbox: new E2BSandbox({ id: 'dev-sandbox' }),
});
```

### 2.4 Agent Tools Provided (10 total)

| Category | Tool Name | Description |
|---|---|---|
| Filesystem | `mastra_workspace_read_file` | Read file (supports line range) |
| Filesystem | `mastra_workspace_write_file` | Create or overwrite file |
| Filesystem | `mastra_workspace_edit_file` | Find and replace in file |
| Filesystem | `mastra_workspace_list_files` | List directory as tree |
| Filesystem | `mastra_workspace_delete` | Delete file or directory |
| Filesystem | `mastra_workspace_file_stat` | Get file metadata |
| Filesystem | `mastra_workspace_mkdir` | Create directory |
| Sandbox | `mastra_workspace_execute_command` | Execute shell command |
| Search | `mastra_workspace_search` | Search indexed content (BM25/vector/hybrid) |
| Search | `mastra_workspace_index` | Index content for search |

### 2.5 Abstract Interfaces (for custom providers)

Both `WorkspaceFilesystem` and `WorkspaceSandbox` are abstract interfaces that can be implemented by custom providers. This means AgentForge can create:
- **DockerSandbox** implementing `WorkspaceSandbox` (our differentiator)
- **R2Filesystem** as a thin wrapper around `S3Filesystem` with R2 defaults
- **ConvexFilesystem** implementing `WorkspaceFilesystem` for Convex file storage

## 3. Technical Requirements

- **Upgrade Mastra:** Upgrade `@mastra/core` to `>=1.1.0` to ensure access to the full Workspace API.
- **Consolidate E2B Sandbox:** Deprecate the standalone `SandboxManager` in favor of Mastra's built-in `E2BSandbox` provider within the Workspace.
- **Adopt Agent Skills Specification:** Refactor the skill system to use the `SKILL.md` format, enabling discovery and activation via the Workspace.
- **Enhance Search:** Add support for vector and hybrid search modes to `AgentForgeWorkspace`.
- **Expand Filesystem Support:** Add R2 as first-class filesystem, plus GCS and mount support.
- **Adopt LocalSandbox Isolation:** Expose `bwrap`/`seatbelt` isolation options for local development.
- **Implement Tool Safety:** Expose `requireApproval` and `requireReadBeforeWrite` per-tool options.
- **Update Documentation:** All related documentation, including READMEs and skills, must be updated.

## 4. Implementation Plan

### 4.1. Core Package (`@agentforge-ai/core`)

- **`workspace.ts`:**
    - Add `vectorStore` and `embedder` options to `CloudWorkspaceConfig` and `LocalWorkspaceConfig`.
    - Add `R2WorkspaceConfig` extending `CloudWorkspaceConfig` with R2-specific defaults (`region: 'auto'`, endpoint pattern).
    - Implement logic to configure vector/hybrid search on the Mastra `Workspace` instance.
    - Add support for `GCSFilesystem` and `mounts` in the `cloud()` factory.
    - Expose `scoreDetails` and `lineRange` in the `search()` return type.
    - Add `tools` configuration with `requireApproval` and `requireReadBeforeWrite` support.
    - Add `skills` parameter support (static paths and dynamic resolver).
- **`sandbox.ts`:**
    - Mark `SandboxManager` as deprecated. Add comments pointing to `AgentForgeWorkspace` and Mastra's `E2BSandbox`.
    - Add `LocalSandboxConfig` with `isolation`, `allowNetwork`, `readOnlyPaths`, `readWritePaths` options.
    - Implement `DockerSandbox` class implementing `WorkspaceSandbox` interface (differentiator).
- **`agent.ts`:**
    - Ensure the `Agent` class can seamlessly consume a fully configured `AgentForgeWorkspace` instance.

### 4.2. CLI (`@agentforge-ai/cli`)

- **`skills` command:**
    - Update `skills create` to generate a `SKILL.md`-compliant skill directory.
    - Update `skills install` and `skills remove` to work with the new skill format.
- **`workspace` command (new):**
    - `workspace init` — Initialize a workspace with filesystem and sandbox configuration.
    - `workspace status` — Show workspace status, mounted filesystems, and sandbox info.

### 4.3. Convex Backend

- **`skills.ts`:**
    - The `skills` table in `schema.ts` may need to be updated or deprecated in favor of filesystem-based skills discovered by the Workspace.
    - This requires a migration strategy. For now, we can support both, but new skills should follow the new spec.

## 5. New GitHub Issues

- **[AF-53] Chore: Upgrade @mastra/core to >=1.1.0** (P1)
- **[AF-54] Refactor: Consolidate E2B sandbox into Mastra Workspace** (P1)
- **[AF-55] Feature: Adopt Agent Skills Specification (SKILL.md)** (P0)
- **[AF-56] Feature: Add Vector and Hybrid Search to Workspace** (P0)
- **[AF-57] Feature: Add R2, GCS, and Mounts Filesystem Support** (P1)
- **[AF-58] Docs: Update all documentation for new Workspace features** (P1)
- **[AF-59] Feature: Expose LocalSandbox native isolation (bwrap/seatbelt)** (P2)
- **[AF-60] Feature: Implement tool safety (requireApproval, requireReadBeforeWrite)** (P1)
- **[AF-61] Feature: Add workspace CLI commands (init, status)** (P2)

## 6. Updated GitHub Issues

- **#38 Docker Sandboxing:** Re-prioritize as a key differentiator. Implement as `DockerSandbox` class implementing `WorkspaceSandbox` interface. Mastra provides `LocalSandbox` (with OS isolation) and `E2BSandbox` but no Docker sandbox.
- **#44 Skill Registry & Marketplace:** Update to align with the Agent Skills specification (SKILL.md format).
- **#12 Memory & Semantic Recall:** Plan to implement using the new Workspace vector search capabilities (`vectorStore` + `embedder`).

## 7. Architecture Decision: R2 as Primary Cloud Filesystem

Given our stack mandate (Cloudflare R2, no AWS S3), AgentForge should:
1. Create an `R2Filesystem` convenience wrapper around `S3Filesystem` with R2 defaults.
2. Document R2 as the primary cloud filesystem in all examples.
3. Use the `mounts` config to mount R2 buckets into E2B sandboxes.
4. Consider a `ConvexFilesystem` for Convex-stored files (future).

## 8. Architecture Decision: Sandbox Strategy

AgentForge should support a tiered sandbox strategy:
1. **LocalSandbox (dev):** For local development with optional `bwrap` isolation.
2. **E2BSandbox (cloud):** For production cloud sandboxes with FUSE mounting.
3. **DockerSandbox (self-hosted):** Our differentiator — for self-hosted production environments.
