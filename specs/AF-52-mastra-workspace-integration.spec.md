# Spec: [AF-52] Mastra Workspace Integration
**Author:** Manus AI
**Date:** 2026-02-17
**Status:** Proposed

## 1. Objective

Fully align AgentForge with the latest Mastra Workspace capabilities to provide a more robust, feature-rich, and standardized agent environment. This involves deprecating legacy implementations (e.g., standalone E2B sandbox) and adopting new features like vector search and the Agent Skills specification.

## 2. Technical Requirements

- **Upgrade Mastra:** Upgrade `@mastra/core` to the latest version to ensure access to the full Workspace API.
- **Consolidate E2B Sandbox:** Deprecate the standalone `SandboxManager` in favor of Mastra's built-in `E2BSandbox` provider within the Workspace.
- **Adopt Agent Skills Specification:** Refactor the skill system to use the `SKILL.md` format, enabling discovery and activation via the Workspace.
- **Enhance Search:** Add support for vector and hybrid search modes to `AgentForgeWorkspace`.
- **Expand Filesystem Support:** Add support for `GCSFilesystem` and `CompositeFilesystem` (mounts).
- **Update Documentation:** All related documentation, including READMEs and skills, must be updated to reflect these changes.

## 3. Implementation Plan

### 3.1. Core Package (`@agentforge-ai/core`)

- **`workspace.ts`:**
    - Add `vectorStore` and `embedder` options to `CloudWorkspaceConfig` and `LocalWorkspaceConfig`.
    - Implement logic to configure vector/hybrid search on the Mastra `Workspace` instance.
    - Add support for `GCSFilesystem` and `mounts` in the `cloud()` factory.
    - Expose `scoreDetails` and `lineRange` in the `search()` return type.
- **`sandbox.ts`:**
    - Mark `SandboxManager` as deprecated. Add comments pointing to `AgentForgeWorkspace` and Mastra's `E2BSandbox`.
- **`agent.ts`:**
    - Ensure the `Agent` class can seamlessly consume a fully configured `AgentForgeWorkspace` instance.

### 3.2. CLI (`@agentforge-ai/cli`)

- **`skills` command:**
    - Update `skills create` to generate a `SKILL.md`-compliant skill directory.
    - Update `skills install` and `skills remove` to work with the new skill format.

### 3.3. Convex Backend

- **`skills.ts`:**
    - The `skills` table in `schema.ts` may need to be updated or deprecated in favor of filesystem-based skills discovered by the Workspace.
    - This requires a migration strategy. For now, we can support both, but new skills should follow the new spec.

## 4. New GitHub Issues

- **[AF-53] Chore: Upgrade @mastra/core to latest version** (P1)
- **[AF-54] Refactor: Consolidate E2B sandbox into Mastra Workspace** (P1)
- **[AF-55] Feature: Adopt Agent Skills Specification** (P0)
- **[AF-56] Feature: Add Vector and Hybrid Search to Workspace** (P0)
- **[AF-57] Feature: Add GCS and Mounts Filesystem Support** (P1)
- **[AF-58] Docs: Update all documentation for new Workspace features** (P1)

## 5. Updated GitHub Issues

- **#38 Docker Sandboxing:** Re-prioritize as a key differentiator, as Mastra does not provide a native Docker sandbox.
- **#44 Skill Registry & Marketplace:** Update to align with the Agent Skills specification.
- **#12 Memory & Semantic Recall:** Plan to implement this using the new Workspace vector search capabilities.
