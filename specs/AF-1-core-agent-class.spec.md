# Spec: [AF-1] Core Agent Class

**Author:** Manus AI
**Date:** 2026-02-12
**Status:** In Progress

## 1. Objective

Implement the core `Agent` class for the AgentForge framework. This class will serve as the fundamental building block for all agents, providing a clean and simple interface for AI orchestration, powered by the Mastra framework.

## 2. Technical Requirements

- The `Agent` class MUST be implemented in TypeScript.
- It MUST wrap the `@mastra/core` Agent class, exposing a simplified and curated API.
- It MUST be part of the `@agentforge-ai/core` package.
- All public methods and properties MUST be documented with JSDoc.
- The implementation MUST be fully type-safe with no `any` types.

## 3. Class: `Agent`

### 3.1. Constructor

```typescript
constructor(config: AgentConfig)
```

**Parameters:**

- `config`: An `AgentConfig` object with the following properties:
    - `id`: `string` - A unique identifier for the agent.
    - `name`: `string` - A human-readable name for the agent.
    - `instructions`: `string` - The system prompt or instructions for the agent.
    - `model`: `string` - The model to use for generation (e.g., 'openai/gpt-4o-mini').
    - `tools`: `object` (optional) - A dictionary of tools available to the agent.

### 3.2. Properties

- `id`: `string` (readonly) - The agent's unique ID.
- `name`: `string` (readonly) - The agent's name.

### 3.3. Methods

#### `generate(prompt: string): Promise<any>`

- **Description:** Generates a structured response from the agent.
- **Parameters:**
    - `prompt`: `string` - The user's prompt or input.
- **Returns:** A `Promise` that resolves to the structured output from the model.

#### `stream(prompt: string): AsyncIterable<any>`

- **Description:** Generates a streaming response from the agent.
- **Parameters:**
    - `prompt`: `string` - The user's prompt or input.
- **Returns:** An `AsyncIterable` that yields chunks of the response as they are generated.

## 4. Tests

**Test Suite:** `agent.test.ts`

- **Test Case 1.1:** `should instantiate an agent with the correct properties`
    - **Given:** An `AgentConfig` object.
    - **When:** A new `Agent` is created.
    - **Then:** The `agent.id` and `agent.name` properties should match the config.

- **Test Case 1.2:** `should handle instantiation without optional tools`
    - **Given:** An `AgentConfig` object without a `tools` property.
    - **When:** A new `Agent` is created.
    - **Then:** The agent should be created successfully without errors.

- **Test Case 2.1:** `generate() should return a structured response`
    - **Given:** An instantiated `Agent` and a prompt.
    - **When:** The `generate()` method is called.
    - **Then:** It should return a non-empty, structured response (mocked from Mastra).

- **Test Case 2.2:** `generate() should throw an error if the underlying call fails`
    - **Given:** An instantiated `Agent` where the underlying Mastra call will fail.
    - **When:** The `generate()` method is called.
    - **Then:** It should throw an appropriate error.

- **Test Case 3.1:** `stream() should return an async iterable`
    - **Given:** An instantiated `Agent` and a prompt.
    - **When:** The `stream()` method is called.
    - **Then:** It should return an object that is an `AsyncIterable`.

- **Test Case 3.2:** `stream() should yield multiple chunks`
    - **Given:** An instantiated `Agent` and a prompt.
    - **When:** The `stream()` method is called and iterated over.
    - **Then:** It should yield at least two distinct chunks of data (mocked from Mastra).

## 5. Implementation Details

- The implementation will be located in `packages/core/src/agent.ts`.
- The tests will be located in `packages/core/src/agent.test.ts`.
- The Mastra agent will be instantiated within the AgentForge `Agent` constructor.
- Methods on the AgentForge `Agent` will delegate to the underlying Mastra agent instance.
