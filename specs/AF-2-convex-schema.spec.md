# Spec: [AF-2] Convex Schema

**Author:** Manus AI
**Date:** 2026-02-12
**Status:** In Progress

## 1. Objective

Define and implement the core Convex database schema for the AgentForge framework. This schema will manage the state for agents, threads, and messages, providing the foundational data layer for multi-agent collaboration.

## 2. Technical Requirements

- The schema MUST be defined in a `schema.ts` file within the `convex` directory.
- It MUST use the `defineSchema` and `defineTable` functions from the `convex/server` module.
- All tables and fields MUST be strongly typed.
- Indexes SHOULD be added to fields that will be frequently queried.

## 3. Schema Definition

The following tables will be created:

### 3.1. `agents` Table

- **Purpose:** Stores the configuration and state of each agent.
- **Fields:**
    - `id`: `v.string()` - The unique identifier for the agent.
    - `name`: `v.string()` - The human-readable name of the agent.
    - `instructions`: `v.string()` - The system prompt for the agent.
    - `model`: `v.string()` - The model used by the agent.
    - `tools`: `v.optional(v.any())` - A JSON object representing the tools available to the agent.
- **Indexes:**
    - `by_id`: `["id"]`

### 3.2. `threads` Table

- **Purpose:** Represents a conversation or a sequence of interactions.
- **Fields:**
    - `name`: `v.optional(v.string())` - An optional name for the thread.
- **Indexes:** None required initially.

### 3.3. `messages` Table

- **Purpose:** Stores individual messages within a thread.
- **Fields:**
    - `threadId`: `v.id("threads")` - A reference to the parent thread.
    - `role`: `v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("tool"))` - The role of the message sender.
    - `content`: `v.string()` - The text content of the message.
    - `tool_calls`: `v.optional(v.any())` - Optional structured data for tool calls.
- **Indexes:**
    - `by_thread`: `["threadId"]`

## 4. Tests

**Test Suite:** `schema.test.ts` (or tested implicitly through queries and mutations)

- **Test Case 1.1:** `should be able to create and retrieve an agent`
    - **Given:** Valid agent data.
    - **When:** A new agent is inserted into the `agents` table.
    - **Then:** The agent can be retrieved by its ID, and the data matches.

- **Test Case 2.1:** `should be able to create a thread`
    - **Given:** No initial data.
    - **When:** A new thread is inserted into the `threads` table.
    - **Then:** The thread is created successfully and has a unique ID.

- **Test Case 3.1:** `should be able to add messages to a thread`
    - **Given:** An existing thread.
    - **When:** Multiple messages with different roles are inserted into the `messages` table, linked to the thread.
    - **Then:** All messages can be retrieved for that thread, ordered by creation time.

- **Test Case 3.2:** `querying messages by thread should be efficient`
    - **Given:** A thread with many messages.
    - **When:** The `by_thread` index is used to query for messages.
    - **Then:** The query should execute efficiently.

## 5. Implementation Details

- The schema will be implemented in `convex/schema.ts`.
- Queries and mutations for interacting with these tables will be created in separate files within the `convex/` directory (e.g., `convex/agents.ts`, `convex/threads.ts`).
- Tests will be written using the Convex test environment to validate the schema and associated functions.
