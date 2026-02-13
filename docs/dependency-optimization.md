# Dependency Optimization

This document records the dependency optimization decisions made for the AgentForge framework, following the NanoClaw philosophy of maintaining a minimal, elegant core.

## v0.2.0: Eliminating onnxruntime-node (520MB)

### Problem

In v0.1.0, the total `node_modules` size was **843MB**. A single transitive dependency, `onnxruntime-node`, accounted for **520MB** (62% of the total install size).

### Root Cause Analysis

The dependency chain was:

```
@agentforge-ai/core
  └── @mastra/core@0.5.0
        └── fastembed@1.14.4
              └── onnxruntime-node@1.21.0  (520MB)
```

`fastembed` is a local embedding model library used by Mastra for vector search and RAG capabilities. It bundles the ONNX Runtime, a machine learning inference engine, as a native binary. This dependency was a **hard dependency** in `@mastra/core@0.5.0`, meaning it was always installed regardless of whether the user needed local embeddings.

AgentForge does not use local embeddings — it follows the BYOK (Bring Your Own Key) pattern where users provide their own model instances, including embedding models if needed.

### Solution

Upgraded `@mastra/core` from `0.5.0` to `1.4.0`. In the v1.x release, the Mastra team restructured their package to remove heavy dependencies:

| Dependency | v0.5.0 | v1.4.0 | Savings |
|---|---|---|---|
| `fastembed` (+ `onnxruntime-node`) | 520MB (hard dep) | Removed | 520MB |
| `cohere-ai` | 7.2MB (hard dep) | Removed | 7.2MB |
| `@aws-sdk/client-sagemaker` | 13MB (hard dep) | Removed | 13MB |
| OpenTelemetry suite | ~15MB (hard dep) | Removed | 15MB |

### Result

| Metric | v0.1.0 | v0.2.0 | Improvement |
|---|---|---|---|
| `node_modules` size | 843MB | 244MB | **-71%** |
| Install time | ~45s | ~7s | **-84%** |
| `onnxruntime-node` present | Yes (520MB) | No | **Eliminated** |

### API Changes

The upgrade from `@mastra/core@0.5.0` to `@1.4.0` introduced minor API changes:

1. **`AgentConfig.model`** now accepts `MastraModelConfig`, which includes `LanguageModelV1 | LanguageModelV2 | string`. Our `Agent` wrapper was updated to accept both `LanguageModelV1` instances and string model IDs (e.g., `'openai/gpt-4o'`).

2. **`AgentConfig.id`** is now a required field (previously only `name` was required). Our wrapper already required `id`, so no user-facing change.

### Decision Rationale

Upgrading to `@mastra/core@1.4.0` was chosen over alternatives because:

- **No functionality loss**: AgentForge never used `fastembed`, `cohere-ai`, or the OpenTelemetry suite directly.
- **Better API**: The v1.x API is more mature and supports string model IDs alongside `LanguageModelV1` instances.
- **Future-proof**: The v1.x line is actively maintained and will receive updates.
- **Massive size reduction**: 71% reduction in install size aligns with the NanoClaw philosophy.

### Guidelines for Future Dependencies

To prevent dependency bloat from recurring:

1. **Audit before adding**: Run `pnpm why <package>` to trace the full dependency tree before adding any new dependency.
2. **Size budget**: The total `node_modules` size for `@agentforge-ai/core` should stay under 300MB.
3. **Prefer peer dependencies**: Large optional features should be peer dependencies, not hard dependencies.
4. **Monitor upgrades**: When upgrading `@mastra/core`, always check the dependency diff with `pnpm why --recursive`.
