# Spec: [AF-3] E2B Sandbox Integration

**Author:** Manus AI
**Date:** 2026-02-12
**Status:** In Progress

## 1. Objective

Integrate the E2B (Edit-to-Build) sandbox for secure, isolated execution of agent tools and arbitrary code. This is a critical security component of the AgentForge framework, ensuring that untrusted code cannot harm the host system.

## 2. Technical Requirements

- The integration MUST use the official E2B SDK for TypeScript.
- A `SandboxManager` class MUST be created to abstract away the details of sandbox creation, execution, and cleanup.
- All tool code execution MUST occur within an E2B sandbox.
- The implementation MUST include configurable timeouts to prevent infinite loops.

## 3. Class: `SandboxManager`

### 3.1. Constructor

```typescript
constructor(config: SandboxConfig)
```

**Parameters:**

- `config`: A `SandboxConfig` object with the following properties:
    - `timeout`: `number` (optional, default: 30000) - The default execution timeout in milliseconds.

### 3.2. Methods

#### `runCode(code: string, options?: SandboxRunOptions): Promise<any>`

- **Description:** Executes a snippet of code within a secure E2B sandbox.
- **Parameters:**
    - `code`: `string` - The code to execute.
    - `options`: `SandboxRunOptions` (optional) - Options for this specific run, such as a custom timeout.
- **Returns:** A `Promise` that resolves to the result of the code execution.

#### `cleanup()`: `Promise<void>`

- **Description:** Terminates the sandbox and releases all associated resources.
- **Returns:** A `Promise` that resolves when the cleanup is complete.

## 4. Tests

**Test Suite:** `sandbox.test.ts`

- **Test Case 1.1:** `should create a sandbox manager`
    - **Given:** A valid sandbox configuration.
    - **When:** A new `SandboxManager` is created.
    - **Then:** The manager is instantiated without errors.

- **Test Case 2.1:** `runCode() should execute code and return the result`
    - **Given:** A `SandboxManager` and a simple JavaScript code snippet (e.g., `1 + 1`).
    - **When:** `runCode()` is called with the snippet.
    - **Then:** It should return the correct result (e.g., `2`).

- **Test Case 2.2:** `runCode() should handle timeouts correctly`
    - **Given:** A `SandboxManager` and a code snippet with an infinite loop.
    - **When:** `runCode()` is called with a short timeout.
    - **Then:** It should throw a `TimeoutError`.

- **Test Case 2.3:** `runCode() should handle errors within the sandboxed code`
    - **Given:** A `SandboxManager` and a code snippet that throws an error.
    - **When:** `runCode()` is called.
    - **Then:** It should throw an error that captures the exception from the sandbox.

- **Test Case 3.1:** `cleanup() should terminate the sandbox`
    - **Given:** An active `SandboxManager` with a running sandbox.
    - **When:** `cleanup()` is called.
    - **Then:** The sandbox should be terminated, and subsequent calls to `runCode()` should fail.

## 5. Implementation Details

- The implementation will be located in `packages/core/src/sandbox.ts`.
- The tests will be located in `packages/core/src/sandbox.test.ts`.
- The E2B SDK will be used to create and manage the sandbox lifecycle.
- The `runCode` method will be responsible for creating a sandbox, executing the code, and then cleaning up the sandbox.
