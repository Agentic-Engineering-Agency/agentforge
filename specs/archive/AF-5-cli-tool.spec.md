# Spec: [AF-5] CLI Tool (@agentforge-ai/cli)

**Author:** Manus AI
**Date:** 2026-02-12
**Status:** In Progress

## 1. Objective

Build the initial command-line interface (CLI) for the AgentForge framework. This tool, published as `@agentforge-ai/cli`, will provide developers with essential commands for creating, running, and managing AgentForge projects.

## 2. Technical Requirements

- The CLI MUST be built with TypeScript and Node.js.
- It MUST use the `commander.js` library for command parsing.
- It MUST be published to npm as a public package named `@agentforge-ai/cli`.
- It MUST include project scaffolding capabilities to quickly set up new AgentForge projects.

## 3. Commands

### 3.1. `agentforge create <project-name>`

- **Description:** Creates a new AgentForge project directory with all the necessary boilerplate.
- **Arguments:**
    - `project-name`: The name of the project and the directory to be created.
- **Functionality:**
    - Creates a new directory with the given project name.
    - Scaffolds a new project with the following structure:
        - `convex/` directory with a basic `schema.ts`.
        - `package.json` with dependencies for `@agentforge-ai/core`, `convex`, and `mastra`.
        - A sample agent definition file.
        - A `tsconfig.json` file.
    - Runs `npm install` (or `pnpm install`) to install dependencies.

### 3.2. `agentforge run`

- **Description:** Starts the local development environment for an AgentForge project.
- **Functionality:**
    - Runs the Convex development server.
    - Watches for file changes and automatically reloads the environment.

## 4. Tests

**Test Suite:** `cli.test.ts`

- **Test Case 1.1:** `create command should generate a new project directory`
    - **Given:** A project name.
    - **When:** The `agentforge create` command is run.
    - **Then:** A new directory with the specified name should be created.

- **Test Case 1.2:** `create command should scaffold the correct file structure`
    - **Given:** A newly created project directory.
    - **When:** The contents of the directory are inspected.
    - **Then:** It should contain a `convex/` directory, a `package.json`, and other required files.

- **Test Case 1.3:** `create command should install dependencies`
    - **Given:** A newly created project.
    - **When:** The `node_modules` directory is checked.
    - **Then:** It should exist and contain the required dependencies.

- **Test Case 2.1:** `run command should start the Convex dev server`
    - **Given:** An existing AgentForge project.
    - **When:** The `agentforge run` command is executed.
    - **Then:** It should spawn the Convex dev server as a child process (mocked).

## 5. Implementation Details

- The CLI will be implemented in a new package at `packages/cli`.
- The main entry point will be `packages/cli/src/index.ts`.
- Project templates will be stored in a `templates/` directory within the CLI package.
- The `create` command will use `fs-extra` to copy the template files to the new project directory.
- The `run` command will use `child_process` to spawn the Convex development server.
