---
title: "Architecture Diagrams"
description: "Comprehensive Mermaid diagrams of system architecture, data flow, security layers, CLI command tree, and deployment topology."
---

# AgentForge Architecture Diagrams

> Generated 2026-03-11 | v0.12.22 | Comprehensive system architecture reference

---

## 1. High-Level System Architecture

The central daemon model — Mastra runs as a persistent Node.js process, Convex serves as the data layer only.

```mermaid
flowchart TB
    subgraph Users["End Users"]
        DEV["Developer<br/>(CLI)"]
        DASH["Dashboard<br/>(Browser)"]
        DISCORD_USER["Discord<br/>User"]
        TELEGRAM_USER["Telegram<br/>User"]
        API_CLIENT["API<br/>Client"]
    end

    subgraph CLI["packages/cli"]
        CLI_BIN["agentforge CLI<br/>(Commander.js)"]
    end

    subgraph Daemon["packages/runtime — AgentForgeDaemon"]
        direction TB
        DAEMON_CORE["AgentForgeDaemon<br/>(Persistent Node.js Process)"]

        subgraph Channels["Channel Adapters"]
            HTTP["HttpChannel<br/>(Hono Server :3001)"]
            DISCORD_CH["DiscordChannel<br/>(discord.js v14)"]
            TELEGRAM_CH["TelegramChannel<br/>(grammy)"]
        end

        subgraph AgentLayer["Agent Runtime"]
            FACTORY["Agent Factory<br/>(createStandardAgent)"]
            MASTRA["Mastra Core<br/>(@mastra/core v1.8)"]
            TOOLS["Built-in Tools<br/>(web-search, datetime,<br/>read-url, notes)"]
        end

        subgraph Security["Security Layer"]
            RATE["Rate Limiter<br/>(60/min, 1000/hr)"]
            SANITIZE["Input Sanitizer<br/>(per-channel limits)"]
            AUTH["Auth Guard<br/>(timing-safe SHA256)"]
        end

        subgraph Storage["Memory & Storage"]
            CONVEX_STORE["ConvexStore<br/>(@mastra/convex)"]
            CONVEX_VECTOR["ConvexVector<br/>(Embeddings)"]
            MODEL_REG["Model Registry<br/>(10 providers, 50+ models)"]
        end
    end

    subgraph ConvexCloud["Convex Cloud — Data Layer Only"]
        SCHEMA["Schema<br/>(39+ tables)"]
        CRYPTO["apiKeysCrypto<br/>(AES-256-GCM)"]
        QUERIES["Queries &<br/>Mutations"]
    end

    subgraph External["External Services"]
        LLM["LLM Providers<br/>(OpenAI, Anthropic, Google,<br/>Mistral, DeepSeek, xAI,<br/>Cohere, MoonshotAI)"]
        DISCORD_API["Discord API"]
        TELEGRAM_API["Telegram API"]
    end

    DEV --> CLI_BIN
    CLI_BIN -->|"agentforge start"| DAEMON_CORE
    CLI_BIN -->|"agentforge chat"| HTTP

    DASH -->|"Real-time queries"| ConvexCloud
    DASH -->|"Chat via /api/chat"| HTTP

    API_CLIENT -->|"POST /v1/chat/completions"| HTTP
    DISCORD_USER --> DISCORD_API --> DISCORD_CH
    TELEGRAM_USER --> TELEGRAM_API --> TELEGRAM_CH

    DAEMON_CORE --> Channels
    DAEMON_CORE --> AgentLayer
    DAEMON_CORE --> Security
    DAEMON_CORE --> Storage

    HTTP --> SANITIZE --> RATE --> AUTH
    AUTH --> FACTORY
    DISCORD_CH --> SANITIZE
    TELEGRAM_CH --> SANITIZE

    FACTORY --> MASTRA
    MASTRA --> TOOLS
    MASTRA -->|"agent.stream()"| LLM
    MASTRA --> CONVEX_STORE
    MASTRA --> CONVEX_VECTOR

    CONVEX_STORE --> ConvexCloud
    CONVEX_VECTOR --> ConvexCloud
    MODEL_REG -->|"Dynamic fetch"| LLM

    style Daemon fill:#1a1a2e,color:#e0e0e0
    style ConvexCloud fill:#0d1b2a,color:#e0e0e0
    style External fill:#2d1b4e,color:#e0e0e0
    style Security fill:#4a1a1a,color:#e0e0e0
```

---

## 2. Package Dependency Graph

Monorepo structure showing workspace dependencies and external packages.

```mermaid
flowchart LR
    subgraph Workspace["pnpm Workspace"]
        CLI["@agentforge-ai/cli<br/>packages/cli/<br/><i>41+ commands</i>"]
        CORE["@agentforge-ai/core<br/>packages/core/<br/><i>Agent primitives</i>"]
        RUNTIME["@agentforge-ai/runtime<br/>packages/runtime/<br/><i>Daemon + Channels</i>"]
        WEB["agentforge-dashboard<br/>packages/web/<br/><i>React Dashboard</i>"]
    end

    subgraph MastraEcosystem["Mastra Ecosystem"]
        MASTRA_CORE["@mastra/core<br/>v1.8.0"]
        MASTRA_CONVEX["@mastra/convex<br/>v1.0.5+"]
        MASTRA_MEMORY["@mastra/memory<br/>v1.5.0+"]
        MASTRA_S3["@mastra/s3"]
    end

    subgraph ChannelDeps["Channel Dependencies"]
        HONO["hono<br/>v4.7+"]
        DISCORDJS["discord.js<br/>v14.18+"]
        GRAMMY["grammy<br/>v1.36+"]
    end

    subgraph UIStack["Dashboard Stack"]
        REACT["React 18.3"]
        VITE["Vite 6.0"]
        TANSTACK["TanStack Router"]
        RADIX["Radix UI"]
        TAILWIND["Tailwind CSS 3.4"]
    end

    subgraph CoreDeps["Core Dependencies"]
        MCP_SDK["@modelcontextprotocol/sdk"]
        PLAYWRIGHT["Playwright"]
        DOCKERODE["Dockerode"]
        SLACK_BOLT["@slack/bolt"]
        CONVEX_SDK["convex"]
    end

    CLI -->|"workspace:*"| CORE
    CLI -->|"workspace:*"| RUNTIME
    CLI --> CONVEX_SDK

    RUNTIME --> MASTRA_CORE
    RUNTIME --> MASTRA_CONVEX
    RUNTIME --> MASTRA_MEMORY
    RUNTIME --> HONO
    RUNTIME --> DISCORDJS
    RUNTIME --> GRAMMY

    CORE --> MASTRA_CORE
    CORE --> MASTRA_S3
    CORE --> MCP_SDK
    CORE --> PLAYWRIGHT
    CORE --> DOCKERODE
    CORE --> SLACK_BOLT
    CORE --> DISCORDJS

    WEB --> REACT
    WEB --> VITE
    WEB --> TANSTACK
    WEB --> RADIX
    WEB --> TAILWIND
    WEB --> CONVEX_SDK

    style Workspace fill:#1a3a1a,color:#e0e0e0
    style MastraEcosystem fill:#1a1a3a,color:#e0e0e0
```

---

## 3. Runtime Daemon Internal Architecture

Detailed view of the AgentForgeDaemon class and its subsystems.

```mermaid
flowchart TD
    DAEMON["AgentForgeDaemon<br/><i>packages/runtime/src/daemon/daemon.ts</i>"]

    DAEMON --> LOADER["Agent Loader<br/><i>AgentDefinitionLoader</i><br/>Fetches from Convex DB"]
    DAEMON --> AGENTS["Agent Map<br/><i>Map&lt;string, Agent&gt;</i><br/>In-memory agent instances"]
    DAEMON --> CHANNELS["Channel Registry<br/><i>ChannelAdapter[]</i>"]
    DAEMON --> WORKFLOW["Workflow Executor<br/><i>WorkflowRunExecutor</i>"]

    subgraph ChannelAdapters["Channel Adapters"]
        HTTP_CH["HttpChannel<br/><i>channels/http.ts (708 LOC)</i>"]
        DISCORD_CH["DiscordChannel<br/><i>channels/discord.ts (150 LOC)</i>"]
        TELEGRAM_CH["TelegramChannel<br/><i>channels/telegram.ts (160 LOC)</i>"]
    end
    CHANNELS --> ChannelAdapters

    subgraph HTTPEndpoints["HTTP Endpoints (Hono)"]
        V1_CHAT["POST /v1/chat/completions<br/><i>OpenAI-compatible, SSE</i>"]
        V1_MODELS["GET /v1/models<br/><i>Provider catalog</i>"]
        API_CHAT["POST /api/chat<br/><i>Dashboard chat + files</i>"]
        API_AGENTS["GET /api/agents<br/><i>Agent listing</i>"]
        WORKFLOW_EP["POST /v1/workflows/runs/:id/execute"]
        HEALTH["GET /health"]
    end
    HTTP_CH --> HTTPEndpoints

    subgraph AgentFactory["Agent Creation Pipeline"]
        CREATE["createStandardAgent()<br/><i>agent/create-standard-agent.ts</i>"]
        MEMORY_INIT["initStorage()<br/><i>ConvexStore + ConvexVector</i>"]
        MODEL_RESOLVE["resolveModel()<br/><i>models/registry.ts</i>"]
    end
    AGENTS --> AgentFactory

    subgraph ModelCatalog["Model Registry"]
        PROVIDERS["10 Providers:<br/>OpenAI, Anthropic, Google,<br/>Mistral, DeepSeek, xAI,<br/>Cohere, MoonshotAI,<br/>OpenRouter, Venice"]
        MODELS["50+ Models<br/><i>GPT-5.x, Claude, Gemini,<br/>Kimi K2.5 (default)</i>"]
        CAPS["Capabilities:<br/>chat, vision, code,<br/>embeddings, reasoning"]
    end
    MODEL_RESOLVE --> ModelCatalog

    subgraph BuiltInTools["Built-in Tools (createTool)"]
        T_SEARCH["web-search<br/><i>Brave API</i>"]
        T_DATETIME["datetime<br/><i>Current time</i>"]
        T_URL["read-url<br/><i>Fetch + JSDOM</i>"]
        T_NOTES["manage-notes<br/><i>In-memory store</i>"]
    end
    CREATE --> BuiltInTools

    subgraph SecurityLayer["Security"]
        RL["RateLimiter<br/><i>Sliding window</i><br/>Burst: 10, Min: 60, Hr: 1000"]
        IS["InputSanitizer<br/><i>Null bytes, control chars</i><br/>Discord: 2K, Telegram: 4K, HTTP: 16K"]
    end
    HTTP_CH --> SecurityLayer
    DISCORD_CH --> IS
    TELEGRAM_CH --> IS

    style DAEMON fill:#2a1a3a,color:#e0e0e0
    style SecurityLayer fill:#4a1a1a,color:#e0e0e0
```

---

## 4. Data Flow — Chat Message Lifecycle

End-to-end flow of a chat message through the system.

```mermaid
sequenceDiagram
    participant U as User
    participant CH as Channel<br/>(HTTP/Discord/Telegram)
    participant IS as InputSanitizer
    participant RL as RateLimiter
    participant AG as Auth Guard
    participant AF as Agent Factory
    participant MA as Mastra Agent
    participant LLM as LLM Provider<br/>(OpenAI/Anthropic/etc.)
    participant CS as ConvexStore
    participant DB as Convex DB

    U->>CH: Send message
    CH->>IS: Sanitize input
    Note over IS: Remove null bytes,<br/>control chars,<br/>enforce length limits
    IS->>RL: Check rate limits
    Note over RL: Sliding window:<br/>burst=10, min=60, hr=1000
    RL->>AG: Authenticate

    alt HTTP Channel
        Note over AG: SHA256 + timingSafeEqual<br/>on Bearer token
    else Discord/Telegram
        Note over AG: Bot token validated<br/>at channel startup
    end

    AG->>AF: Route to agent
    AF->>MA: agent.stream(messages, {threadId, resourceId})

    MA->>LLM: Stream LLM request
    Note over LLM: SSE chunks

    loop For each chunk
        LLM-->>MA: Chunk (delta content)
        MA-->>CH: Forward SSE chunk
        CH-->>U: Display progressive text
    end

    par Persist conversation
        MA->>CS: Save thread + messages
        CS->>DB: Write to mastra_threads,<br/>mastra_messages
    and Track usage
        MA->>DB: Write to usage,<br/>usageEvents, logs
    end

    LLM-->>MA: [DONE]
    MA-->>CH: Stream complete
    CH-->>U: Final response
```

---

## 5. Convex Data Layer — Entity Relationship Diagram

All 39+ tables with key relationships.

```mermaid
erDiagram
    projects ||--o{ agents : "has"
    projects ||--o{ threads : "has"
    projects ||--o{ files : "has"
    projects ||--o{ cronJobs : "has"
    projects ||--o{ skills : "has"
    projects ||--o{ mcpConnections : "has"
    projects ||--o{ channelConnections : "has"
    projects ||--o{ workflowDefinitions : "has"
    projects ||--o{ researchJobs : "has"
    projects ||--o{ memoryEntries : "has"
    projects ||--o{ projectMembers : "has"

    agents ||--o{ threads : "conversations"
    agents ||--o{ sessions : "sessions"
    agents ||--o{ cronJobs : "schedules"
    agents ||--o{ instances : "runs"
    agents ||--o{ heartbeats : "monitors"
    agents ||--o{ memoryEntries : "remembers"
    agents ||--o{ a2aTasks : "delegates"

    threads ||--o{ messages : "contains"
    threads ||--o{ sessions : "tracked_by"

    cronJobs ||--o{ cronJobRuns : "executions"

    workflowDefinitions ||--o{ workflowRuns : "executions"
    workflowRuns ||--o{ workflowSteps : "steps"

    vault ||--o{ vaultAuditLog : "audited_by"

    memoryEntries ||--o{ memoryConsolidations : "consolidated_into"

    files }o--|| folders : "in_folder"
    folders }o--o| folders : "nested_in"

    projects {
        string name
        string description
        string defaultModel
        string systemPrompt
        boolean isDefault
    }

    agents {
        string id PK
        string name
        string model
        string provider
        string instructions
        boolean isActive
        boolean sandboxEnabled
    }

    threads {
        string name
        string agentId FK
        string userId
    }

    messages {
        id threadId FK
        string role
        string content
        any tool_calls
    }

    apiKeys {
        string provider
        string encryptedKey
        string iv
        string tag
        boolean isActive
    }

    vault {
        string name
        string category
        string encryptedValue
        string iv
        string maskedValue
    }

    sessions {
        string sessionId
        id threadId FK
        string agentId FK
        string status
        string channel
    }

    usage {
        string agentId FK
        string provider
        string model
        number promptTokens
        number completionTokens
        number cost
    }

    channelConnections {
        string agentId FK
        string channel
        object config
        string status
    }

    a2aTasks {
        string taskId PK
        string fromAgentId FK
        string toAgentId FK
        string status
        string instruction
    }

    memoryEntries {
        string content
        string type
        string agentId FK
        array embedding
        number importance
    }

    skillMarketplace {
        string name
        string version
        string author
        number downloads
        boolean featured
    }

    mastra_threads {
        string id PK
        string resourceId
        string title
    }

    mastra_messages {
        string id PK
        string thread_id FK
        any content
        string role
    }

    mastra_vectors {
        string id PK
        string indexName
        array embedding
    }
```

---

## 6. CLI Command Tree

All 41+ commands organized by category.

```mermaid
mindmap
  root((agentforge))
    Project Lifecycle
      create
      run
      upgrade
      deploy
    Runtime
      start
      status
    Chat & Sessions
      chat
      sessions
      threads
    Agent Management
      agents
    Models & Keys
      models
      keys
      tokens
      vault
    Skills & Tools
      skills
      skill
    Workflows & Jobs
      workflows
      cron
      research
    Integrations
      mcp
      sandbox
    Channels
      channel-telegram
      channel-whatsapp
      channel-slack
      channel-discord
    Configuration
      config
      workspace
      projects
    Data
      files
    Dashboard
      dashboard
```

---

## 7. Security Architecture

Encryption, authentication, and protection layers — including known violations.

```mermaid
flowchart TD
    subgraph Correct["Correct Pattern (Node.js Runtime)"]
        direction TB
        AK["API Key Storage<br/><i>convex/apiKeys.ts</i>"]
        CRYPTO["apiKeysCrypto.ts<br/><i>'use node' internalAction</i>"]
        NODE_CRYPTO["node:crypto<br/><i>AES-256-GCM</i>"]
        HKDF["HKDF-SHA256<br/><i>Key derivation</i>"]
        SALT["AGENTFORGE_KEY_SALT<br/><i>Env var, min 32 chars</i>"]

        AK -->|"encrypt/decrypt"| CRYPTO
        CRYPTO --> NODE_CRYPTO
        CRYPTO --> HKDF
        HKDF --> SALT
    end

    subgraph Violation["VIOLATION — crypto.subtle in V8"]
        direction TB
        VAULT["vault.ts<br/><i>query + mutation (V8!)</i>"]
        VAULT_CRYPTO["crypto.subtle<br/><i>PBKDF2 100K iterations</i>"]
        VAULT_ISSUE["10-19s latency<br/>per operation"]

        CC["channelConnections.ts<br/><i>internalQuery (V8!)</i>"]
        CC_CRYPTO["crypto.subtle.importKey<br/><i>+ deriveKey</i>"]
        CC_ISSUE["Slow decryption<br/>on every query"]

        VAULT -->|"uses"| VAULT_CRYPTO
        VAULT_CRYPTO -->|"causes"| VAULT_ISSUE
        CC -->|"uses"| CC_CRYPTO
        CC_CRYPTO -->|"causes"| CC_ISSUE
    end

    subgraph HTTPSecurity["HTTP Channel Security"]
        RATE["Rate Limiter<br/><i>In-memory sliding window</i>"]
        RATE_CONFIG["Burst: 10<br/>Per-minute: 60<br/>Per-hour: 1000"]
        INPUT["Input Sanitizer<br/><i>Null bytes, control chars</i>"]
        INPUT_LIMITS["HTTP: 16K chars<br/>Discord: 2K chars<br/>Telegram: 4K chars"]
        AUTH_GUARD["Auth Guard<br/><i>Bearer token</i>"]
        TIMING["SHA256 + timingSafeEqual<br/><i>No timing attacks</i>"]
        CORS["CORS Protection<br/><i>Configurable origins</i>"]

        RATE --- RATE_CONFIG
        INPUT --- INPUT_LIMITS
        AUTH_GUARD --> TIMING
    end

    subgraph EnvValidation["Environment Validation"]
        VALIDATE["validate-env.ts<br/><i>Startup checks</i>"]
        REQ["Required:<br/>CONVEX_URL<br/>AGENTFORGE_KEY_SALT"]
        OPT["Per-channel optional:<br/>DISCORD_BOT_TOKEN<br/>TELEGRAM_BOT_TOKEN<br/>Provider API keys"]
    end

    style Correct fill:#1a3a1a,color:#e0e0e0
    style Violation fill:#5a1a1a,color:#ffaaaa
    style HTTPSecurity fill:#1a1a3a,color:#e0e0e0
```

---

## 8. Template Sync Flow

4-location synchronization mechanism ensuring scaffolded projects get latest templates.

```mermaid
flowchart LR
    SOURCE["CANONICAL SOURCE<br/><i>packages/cli/templates/<br/>default/convex/</i>"]

    DIST["npm dist copy<br/><i>packages/cli/dist/<br/>default/convex/</i>"]
    ROOT["Root template copy<br/><i>templates/default/<br/>convex/</i>"]
    LOCAL["Local dev copy<br/><i>convex/</i>"]

    SYNC["pnpm sync-templates<br/><i>scripts/sync-templates.sh</i><br/>(rsync -av --delete)"]

    SOURCE -->|"syncs to"| SYNC
    SYNC -->|"1"| DIST
    SYNC -->|"2"| ROOT
    SYNC -->|"3"| LOCAL

    EDIT["Developer edits<br/>canonical source"]
    EDIT --> SOURCE

    CREATE["agentforge create<br/>(copies from dist)"]
    DIST --> CREATE

    subgraph DriftWarning["Current Drift"]
        DRIFT1["apiAccessTokensActions.ts<br/><i>local: 1134B vs canonical: 1077B</i>"]
        DRIFT2["context.ts<br/><i>local: 6206B vs canonical: 6736B</i>"]
    end

    style SOURCE fill:#1a3a1a,color:#e0e0e0
    style DriftWarning fill:#5a3a1a,color:#ffddaa
```

---

## 9. Deployment Architecture

How AgentForge runs in development and production.

```mermaid
flowchart TB
    subgraph DevMachine["Developer Machine"]
        CLI["agentforge CLI"]
        DAEMON["Node.js Daemon<br/>(:3001 HTTP)"]
        DASHBOARD["Vite Dev Server<br/>(:5173 Dashboard)"]
        CONVEX_DEV["npx convex dev<br/>(schema sync)"]
    end

    subgraph ConvexCloud["Convex Cloud"]
        DB["Convex Database<br/>(39+ tables)"]
        ACTIONS["Node.js Actions<br/>(AES-256-GCM crypto)"]
        QUERIES["V8 Queries<br/>(real-time subscriptions)"]
        FILES["File Storage<br/>(generateUploadUrl)"]
    end

    subgraph LLMProviders["LLM Providers"]
        OPENAI["OpenAI<br/>GPT-5.x"]
        ANTHROPIC["Anthropic<br/>Claude"]
        GOOGLE["Google<br/>Gemini"]
        MOONSHOT["MoonshotAI<br/>Kimi K2.5 (default)"]
        OTHERS["Mistral, DeepSeek,<br/>xAI, Cohere,<br/>OpenRouter, Venice"]
    end

    subgraph ChatPlatforms["Chat Platforms"]
        DISCORD["Discord API<br/>(discord.js v14)"]
        TELEGRAM["Telegram API<br/>(grammy)"]
    end

    subgraph NPM["npm Registry"]
        PKG_CORE["@agentforge-ai/core"]
        PKG_RUNTIME["@agentforge-ai/runtime"]
        PKG_CLI["@agentforge-ai/cli"]
    end

    CLI -->|"agentforge start"| DAEMON
    CLI -->|"agentforge dashboard"| DASHBOARD
    CLI -->|"agentforge create"| PKG_CLI

    DAEMON -->|"ConvexStore"| DB
    DAEMON -->|"agent.stream()"| LLMProviders
    DAEMON -->|"Bot adapter"| ChatPlatforms
    DASHBOARD -->|"Real-time queries"| QUERIES
    CONVEX_DEV -->|"Schema deploy"| DB

    ACTIONS -->|"Encrypt/decrypt"| DB
    QUERIES -->|"Read"| DB
    FILES -->|"Upload/download"| DB

    style DevMachine fill:#1a2a1a,color:#e0e0e0
    style ConvexCloud fill:#0d1b2a,color:#e0e0e0
    style LLMProviders fill:#2d1b4e,color:#e0e0e0
```

---

## Legend

| Symbol | Meaning |
|--------|---------|
| Solid arrow | Direct dependency / data flow |
| Dashed arrow | Async / eventual flow |
| Green background | Healthy / correct pattern |
| Red background | Violation / needs fix |
| Orange background | Warning / drift detected |

---

*Generated by Claude Opus 4.6 — Architecture audit of AgentForge v0.12.22*
