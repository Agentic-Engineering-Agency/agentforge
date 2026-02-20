# Teammate 3: Storage & Models Analysis

**Date:** February 20, 2026  
**Analyst:** Teammate 3 — Storage & Models Analyst  
**Scope:** AGE-77 File Upload/Storage Investigation + Latest AI Models Audit

---

## Task 1: File Upload & Storage Investigation

### 1.1 File Upload UI Components

#### agentforge (OSS framework) — `packages/web`
**File:** `/packages/web/app/routes/files.tsx`

A full-featured file manager UI exists in the open-source `agentforge/packages/web` package. It includes:
- **Drag-and-drop upload zone** (`onDragOver`, `onDrop` handlers)
- **Click-to-upload button** with a hidden `<input type="file" multiple>`
- **Grid and list view modes** for browsing files/folders
- **Folder creation, renaming, deletion** modals
- **Breadcrumb navigation** for nested folders
- **File type icons** (image, code, archive, text)
- **In-memory state only** — all uploads are local React state, **NOT persisted to any backend or R2**

> **Critical Gap:** The existing UI in `packages/web` uses only mock/in-memory data. There is no Convex mutation called on upload, and no R2 `store()` call wired up. File uploads are purely visual — they disappear on refresh.

#### agentforge-cloud (SaaS dashboard) — `apps/dashboard`
No dedicated file upload route exists in the agentforge-cloud dashboard at:
`/apps/dashboard/src/routes/`

No file upload UI components were found in `apps/dashboard/src/`. The dashboard contains: `agents.tsx`, `billing.tsx`, `api-keys.tsx`, `settings.tsx`, and project/org pages — **but no files page**.

---

### 1.2 Convex Schema — File/Document Storage Tables

#### agentforge OSS — Template Schema
**File:** `/packages/cli/templates/default/convex/schema.ts`

The CLI template includes both a `files` and `folders` table:

```typescript
// File storage metadata (files stored in Cloudflare R2)
files: defineTable({
  name: v.string(),
  originalName: v.string(),
  mimeType: v.string(),
  size: v.number(),
  url: v.string(),            // Cloudflare R2 URL
  folderId: v.optional(v.id("folders")),
  projectId: v.optional(v.id("projects")),
  userId: v.optional(v.string()),
  uploadedAt: v.number(),
  metadata: v.optional(v.any()),
})

folders: defineTable({
  name: v.string(),
  parentId: v.optional(v.id("folders")),
  projectId: v.optional(v.id("projects")),
  userId: v.optional(v.string()),
  ...
})
```

**Supporting Convex functions:** `/packages/cli/templates/default/convex/files.ts`  
Provides `list`, `get`, `create`, `update`, `remove`, `moveToFolder` mutations/queries. The `create` mutation stores metadata only (name, mimeType, size, R2 url) — the **actual binary upload to R2 is expected to happen separately** before calling this mutation.

#### agentforge-cloud — Schema
**File:** `/convex/schema.ts`

The agentforge-cloud schema does **NOT** include a `files` or `documents` table. Storage concerns are limited to:
- `dataExports` — GDPR export files (with `downloadUrl`)
- `deployments` — artifact URLs for deployed agents

No general-purpose file storage table exists in the cloud schema.

---

### 1.3 R2 / Cloudflare Storage Integration

#### agentforge-cloud — `convex/r2Storage.ts`
**File:** `/Users/agent/Projects/Agentic-Engineering-Agency/agentforge-cloud/convex/r2Storage.ts`

R2 integration is **already implemented** using `@convex-dev/r2`. The following internal actions exist:

| Function | Purpose |
|---|---|
| `storeAgentConfig` | Stores agent YAML/JSON configs: `orgs/{orgId}/projects/{projectId}/agents/{agentId}/config.{ext}` |
| `storeDeploymentArtifact` | Stores deployment bundles: `orgs/{orgId}/projects/{projectId}/deployments/{deploymentId}/{filename}` |
| `storeLogFile` | Stores log files by date: `orgs/{orgId}/projects/{projectId}/agents/{agentId}/logs/{date}/{timestamp}.log` |
| `getFileUrl` | Returns a public URL for an R2 object |
| `deleteFile` | Deletes an R2 object by key |

**Current R2 usage is limited to agent/deployment system files only.** There is no support for user-uploaded files (documents, images, data files).

#### agentforge OSS — Docs
**File:** `/docs/deployment.md`

Documents R2 setup with environment variables (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`), but this is documentation-only — no actual worker-level upload handler is wired up in code.

---

### 1.4 AGE-77: "Add R2, GCS, Mounts Filesystem Support" — Planned vs Implemented

**Spec files found:** No AGE-77 spec file exists in `/specs/`. The spec numbering in that directory goes up to AF-52.

**What is Planned (per AGENTFORGE_CLOUD_PLAN.md):**
- Cloudflare R2 for all user-uploaded files and agent-generated artifacts via `@convex-dev/r2`
- GCS and Mounts Filesystem are referenced in AGE-77 but not in any existing spec or codebase files

**What is Implemented:**
- R2 backend actions for system files (agent configs, deployment artifacts, logs) — agentforge-cloud only
- Schema for file metadata in OSS template (`files` + `folders` tables)
- In-memory UI for file browsing/upload in OSS `packages/web` (no backend integration)

**What is Missing / Still Needed (AGE-77 scope):**
1. User-facing file upload flow: presigned URL generation or direct upload to R2 via Convex action
2. `files` table in agentforge-cloud schema (currently absent)
3. File upload UI in agentforge-cloud dashboard (`apps/dashboard`)
4. Wire `packages/web/routes/files.tsx` to Convex mutations + R2 upload
5. GCS support — not started
6. Mounts filesystem (for E2B sandbox or persistent agent workspaces) — not started
7. File download with authenticated URL generation (via `r2.getUrl()`)

---

### 1.5 Summary: Storage Gap Analysis

| Feature | OSS Framework | Cloud SaaS |
|---|---|---|
| R2 backend integration | Not wired | Partial (system files only) |
| User file upload UI | Yes (in-memory only) | No |
| Files Convex schema | Yes (template) | No |
| Folders Convex schema | Yes (template) | No |
| Presigned upload flow | No | No |
| GCS support | No | No |
| Mounts filesystem | No | No |
| File download/URL | No | Partial (getFileUrl action) |

---

## Task 2: Latest AI Models Research (February 2026)

### 2.1 Anthropic Claude

| Model | API Model ID | Released | Notes |
|---|---|---|---|
| Claude Opus 4.6 | `claude-opus-4-6` | Feb 5, 2026 | Flagship; agent teams; 1M context (beta) |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Feb 17, 2026 | Default model on claude.ai; same pricing as Sonnet 4.5; $3/$15 per M tokens |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Late 2025 | Fastest/cheapest Claude; near-frontier performance |
| Claude Sonnet 4.5 | `claude-sonnet-4-5` | 2025 | Previous default, still available |
| Claude Opus 4.5 | `claude-opus-4-5` | 2025 | Previous Opus generation |

---

### 2.2 OpenAI

| Model | API Model ID | Category | Notes |
|---|---|---|---|
| GPT-5.2 | `gpt-5.2` | Frontier | Latest flagship; Responses API + Chat Completions |
| GPT-5.2 Pro | `gpt-5.2-pro` | Frontier Pro | Most capable, Responses API only |
| GPT-5 | `gpt-5` | General | Strong general purpose |
| GPT-5 Mini | `gpt-5-mini` | Efficient | Cost-optimized |
| GPT-5 Nano | `gpt-5-nano` | Fastest | Lowest latency/cost |
| GPT-4.1 | `gpt-4.1` | Coding | Excels at coding; fine-tuning available |
| GPT-4.1 Mini | `gpt-4.1-mini` | Coding Efficient | Smaller GPT-4.1 |
| GPT-4.1 Nano | `gpt-4.1-nano` | Coding Fast | Fastest GPT-4.1 variant |
| o3 | `o3` | Reasoning | Advanced reasoning |
| o3-pro | `o3-pro` | Reasoning Pro | More compute for hard problems |
| o4-mini | `o4-mini` | Reasoning Fast | Fast reasoning; fine-tuning available |
| o3-deep-research | `o3-deep-research` | Research | Deep analysis tasks |
| o4-mini-deep-research | `o4-mini-deep-research` | Research Fast | Affordable research |

> Note: GPT-4o and o3-mini are retired/deprecated. API access may still work but these are not recommended for new integrations.

---

### 2.3 Google Gemini

| Model | API Model ID | Notes |
|---|---|---|
| Gemini 3.1 Pro | `gemini-3.1-pro` | Preview; released Feb 19, 2026; latest flagship |
| Gemini 3 Flash | `gemini-3-flash` | New default in Gemini app; major upgrade over 2.5 Flash |
| Gemini 2.5 Pro | `gemini-2.5-pro` | GA; complex reasoning, code, multimodal |
| Gemini 2.5 Flash | `gemini-2.5-flash` | GA; high-throughput, budget-friendly |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | GA; classification, translation, high-scale workloads |
| Gemini 2.0 Flash | `gemini-2.0-flash` | Stable; still widely used |

---

### 2.4 Mistral AI

| Model | API Model ID | Notes |
|---|---|---|
| Mistral Large 3 | `mistral-large-latest` | 675B total / 41B active MoE; 256K context; multimodal |
| Ministral 14B | `ministral-14b-latest` | Dense; multimodal, multilingual |
| Ministral 8B | `ministral-8b-latest` | Dense; efficient |
| Ministral 3B | `ministral-3b-latest` | Smallest; edge devices |
| Devstral 2 | `devstral-2-latest` | 123B coding specialist (Dec 2025) |
| Devstral Small 2 | `devstral-small-2-latest` | 24B coding specialist |
| Mistral Small 3.1 | `mistral-small-latest` | Mar 2025; efficient small model |
| Mistral Medium 3 | `mistral-medium-latest` | May 2025 |
| Codestral | `codestral-latest` | Code generation specialist |
| Mistral OCR 3 | `mistral-ocr-2512` | Document OCR |

---

### 2.5 Meta Llama

| Model | Hugging Face / API ID | Notes |
|---|---|---|
| Llama 4 Maverick | `meta-llama/Llama-4-Maverick` | 17B active / 400B total; 128 experts MoE; multimodal; Apr 2025 |
| Llama 4 Scout | `meta-llama/Llama-4-Scout` | 17B active / 109B total; 10M token context |
| Llama 4 Behemoth | (upcoming) | 2T parameter; not yet released |
| Llama 3.3 70B | `meta-llama/Llama-3.3-70B-Instruct` | Previous gen; widely available via Venice/OpenRouter |

> Available via OpenRouter, Groq, Venice AI, and direct download from llama.com / HuggingFace.

---

### 2.6 xAI Grok

| Model | Notes |
|---|---|
| Grok 4.1 | Latest; Fast and Thinking variants; OpenAI-compatible pricing; strong reasoning |
| Grok 3 | Released Feb 2025; trained on 200K H100 GPUs |

> Available via xAI API (`api.x.ai`) with OpenAI-compatible endpoint.

---

### 2.7 DeepSeek

| Model | API Model ID | Notes |
|---|---|---|
| DeepSeek V3 | `deepseek-chat` | 671B total / 37B active MoE; open-weights |
| DeepSeek V3.2 | `deepseek-chat` (updated) | Evolved non-thinking variant |
| DeepSeek R1 | `deepseek-reasoner` | Reasoning/thinking model; open-weights |

> API at `api.deepseek.com` (OpenAI-compatible). Also available via OpenRouter and Venice AI.

---

### 2.8 Cohere

| Model | API Model ID | Notes |
|---|---|---|
| Command A 03-2025 | `command-a-03-2025` | Most performant; 150% throughput of predecessor on 2 GPUs |
| Command A Translate | `command-a-translate-08-2025` | Specialized translation model |
| Command R+ (Aug 2024) | `command-r-plus-08-2024` | 50% higher throughput vs prior Command R+ |
| Command R (Aug 2024) | `command-r-08-2024` | Efficient retrieval-focused model |

---

### 2.9 Amazon Nova

| Model | Bedrock Model ID | Notes |
|---|---|---|
| Amazon Nova 2 Pro | `amazon.nova-pro-v2:0` | Most intelligent; complex multistep tasks; 1M context; Dec 2025 |
| Amazon Nova 2 Lite | `amazon.nova-lite-v2:0` | Fast, cost-effective reasoning |
| Amazon Nova 2 Sonic | `amazon.nova-sonic-v2:0` | Multilingual conversational AI |
| Amazon Nova Pro | `amazon.nova-pro-v1:0` | Original Nova Pro |
| Amazon Nova Lite | `amazon.nova-lite-v1:0` | Original Nova Lite |
| Amazon Nova Micro | `amazon.nova-micro-v1:0` | Smallest/fastest; text-only |

> Nova 2 models: extended thinking with low/medium/high intensity; built-in code interpreter and web grounding.

---

## Task 3: Current Models in Codebase vs Latest Available

### 3.1 Where Models Are Defined

**agentforge-cloud — Primary model list:**  
`/convex/llmProviders.ts` — `SUPPORTED_PROVIDERS` constant defines providers and their model lists.

**agentforge — Model resolver (no hardcoded model list):**  
`/packages/convex-adapter/src/model-resolver.ts` — Provider enum only (openai, anthropic, google, venice, openrouter, custom). No hardcoded model IDs — models are passed as strings at runtime.

**agentforge-cloud dashboard model display:**  
`/apps/dashboard/src/routes/dashboard/agents.tsx` — Displays `agent.model` as a raw string from DB. No model selection dropdown or validation UI exists.

---

### 3.2 Current Models in `SUPPORTED_PROVIDERS` vs Latest

#### Anthropic

| Currently Listed | Status | Action Needed |
|---|---|---|
| `claude-sonnet-4-20250514` | Stale ID format | Replace with `claude-sonnet-4-6` |
| `claude-3-5-haiku-20241022` | Old Haiku 3.5 | Replace with `claude-haiku-4-5-20251001` |
| `claude-3-5-sonnet-20241022` | Old Sonnet 3.5 | Remove (superseded by 4.x) |
| (missing) | — | Add `claude-opus-4-6` |
| (missing) | — | Add `claude-sonnet-4-6` (set as defaultModel) |
| (missing) | — | Add `claude-opus-4-5` |

#### OpenAI

| Currently Listed | Status | Action Needed |
|---|---|---|
| `gpt-4o` | Legacy/deprecated from ChatGPT | Keep but mark legacy |
| `gpt-4o-mini` | Legacy | Keep but mark legacy |
| `gpt-4.1` | Current | Keep |
| `gpt-4.1-mini` | Current | Keep |
| `gpt-4.1-nano` | Current | Keep |
| `o3-mini` | Deprecated — replaced by `o4-mini` | Replace with `o4-mini` |
| (missing) | — | Add `gpt-5`, `gpt-5-mini`, `gpt-5-nano` |
| (missing) | — | Add `o3`, `o3-pro`, `o4-mini` |

#### Google

| Currently Listed | Status | Action Needed |
|---|---|---|
| `gemini-2.5-flash` | Current GA | Keep |
| `gemini-2.0-flash` | Stable | Keep |
| `gemini-2.5-pro` | Current GA | Keep |
| (missing) | — | Add `gemini-3-flash` |
| (missing) | — | Add `gemini-3.1-pro` (mark as preview) |
| (missing) | — | Add `gemini-2.5-flash-lite` |

#### Venice AI

| Currently Listed | Status | Action Needed |
|---|---|---|
| `llama-3.3-70b` | Available | Keep |
| `deepseek-r1-671b` | Available | Keep |
| `qwen-2.5-vl` | Available | Keep |
| (missing) | — | Add `llama-4-maverick`, `llama-4-scout` |

#### OpenRouter

| Currently Listed | Status | Action Needed |
|---|---|---|
| `openai/gpt-4o` | Legacy | Update to `openai/gpt-5` or `openai/gpt-4.1` |
| `anthropic/claude-sonnet-4-20250514` | Stale ID | Update to `anthropic/claude-sonnet-4-6` |
| `google/gemini-2.0-flash-001` | Stable | Keep; add `google/gemini-2.5-pro` |
| (missing) | — | Add `meta-llama/llama-4-maverick` |
| (missing) | — | Add `deepseek/deepseek-chat` |

---

### 3.3 Missing Providers Entirely

The following providers are not currently supported in `model-resolver.ts` or `llmProviders.ts`:

| Provider | Key Models to Add | Integration Method |
|---|---|---|
| **Mistral** | `mistral-large-latest`, `codestral-latest`, `mistral-small-latest` | `@ai-sdk/mistral` |
| **DeepSeek** | `deepseek-chat`, `deepseek-reasoner` | OpenAI-compatible (`@ai-sdk/openai-compatible` at `api.deepseek.com`) |
| **xAI / Grok** | Grok 3, Grok 4.1 | OpenAI-compatible (`api.x.ai`) |
| **Amazon Bedrock** | `amazon.nova-pro-v2:0`, `amazon.nova-lite-v2:0` + Claude on Bedrock | `@ai-sdk/amazon-bedrock` |
| **Cohere** | `command-a-03-2025`, `command-r-plus-08-2024` | `@ai-sdk/cohere` |

---

## Summary of Key Findings & Recommendations

### Storage (AGE-77)

1. **R2 backend partially implemented** in agentforge-cloud (system files only). Needs a **user-facing upload flow** using presigned URLs or a Convex action wrapping `r2.store()`.
2. **agentforge-cloud schema lacks a `files` table**. The OSS template's `files`+`folders` schema can be adapted and added to the cloud schema.
3. **agentforge-cloud dashboard** needs a files management page. The OSS `packages/web/routes/files.tsx` is a solid UI foundation but must be wired to Convex mutations and R2.
4. **GCS and Mounts** (E2B sandbox persistent workspaces) have zero implementation — these are the largest remaining AGE-77 gap items.

### Models

1. **Anthropic models need immediate update**: `defaultModel` should change from `claude-sonnet-4-20250514` to `claude-sonnet-4-6`; add `claude-opus-4-6`.
2. **OpenAI `o3-mini` is deprecated** — replace with `o3` and `o4-mini`; add GPT-5 family.
3. **Google Gemini 3** family released (Feb 19, 2026) — `gemini-3-flash` and `gemini-3.1-pro` should be added.
4. **Mistral is completely absent** despite being a major provider with Vercel AI SDK support (`@ai-sdk/mistral`).
5. **DeepSeek and xAI/Grok** are accessible via OpenAI-compatible API but have no explicit provider support.
6. **`model-resolver.ts`** only handles 6 providers — needs Mistral, DeepSeek, xAI, Cohere, and Bedrock added.
7. **No model selection UI** exists in agentforge-cloud dashboard — the agent form just stores a raw string with no dropdown/validation.

---

*Research Sources:*
- [Introducing Claude Opus 4.6 — Anthropic](https://www.anthropic.com/news/claude-opus-4-6)
- [Claude Sonnet 4.6 — CNBC](https://www.cnbc.com/2026/02/17/anthropic-ai-claude-sonnet-4-6-default-free-pro.html)
- [Anthropic Release Notes — Releasebot](https://releasebot.io/updates/anthropic)
- [OpenAI Models Documentation](https://platform.openai.com/docs/models)
- [Introducing GPT-4.1 — OpenAI](https://openai.com/index/gpt-4-1/)
- [Introducing o3 and o4-mini — OpenAI](https://openai.com/index/introducing-o3-and-o4-mini/)
- [Gemini 2.5 GA on Vertex AI — Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/gemini-2-5-flash-lite-flash-pro-ga-vertex-ai)
- [Gemini API Models Docs](https://ai.google.dev/gemini-api/docs/models)
- [Mistral 3 Launch](https://mistral.ai/news/mistral-3)
- [Devstral 2 — Mistral AI](https://mistral.ai/news/devstral-2-vibe-cli)
- [Llama 4 Blog — Meta](https://ai.meta.com/blog/llama-4-multimodal-intelligence/)
- [Amazon Nova 2 Announcement — AWS](https://aws.amazon.com/about-aws/whats-new/2025/12/nova-2-foundation-models-amazon-bedrock/)
- [Cohere Models Documentation](https://docs.cohere.com/docs/models)
- [DeepSeek V3 — GitHub](https://github.com/deepseek-ai/DeepSeek-V3)
