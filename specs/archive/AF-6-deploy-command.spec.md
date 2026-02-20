# AF-6: `agentforge deploy` Command

## Overview

The `agentforge deploy` command deploys an AgentForge project's Convex backend to production. It handles environment variable configuration, provides deployment status feedback, and supports rollback capabilities.

## Scope

- Deploy Convex backend to production via `npx convex deploy`
- Validate project structure before deployment
- Handle environment variable configuration (push env vars to Convex)
- Provide real-time deployment status feedback
- Support `--rollback` flag to revert to previous deployment
- Support `--dry-run` flag to preview what would be deployed
- Support `--env` flag to specify environment file path

## API

```
agentforge deploy [options]

Options:
  --env <path>     Path to .env file (default: .env.production)
  --dry-run        Preview deployment without executing
  --rollback       Rollback to previous deployment
  --force          Skip confirmation prompts
  -h, --help       Display help
```

## Implementation

### File: `packages/cli/src/commands/deploy.ts`

```typescript
export interface DeployOptions {
  env: string;
  dryRun: boolean;
  rollback: boolean;
  force: boolean;
}

export async function deployProject(options: DeployOptions): Promise<void>;
```

### Behavior

1. **Validation Phase**
   - Check `package.json` exists (valid project)
   - Check `convex/` directory exists
   - Check `.env.production` (or `--env` path) exists

2. **Dry Run Mode** (`--dry-run`)
   - Display what would be deployed
   - List environment variables that would be set
   - Exit without executing

3. **Rollback Mode** (`--rollback`)
   - Execute `npx convex deploy --rollback`
   - Display rollback status

4. **Deploy Mode** (default)
   - Display deployment plan
   - If not `--force`, prompt for confirmation
   - Push environment variables via `npx convex env set`
   - Execute `npx convex deploy`
   - Display success/failure status

## Test Cases

1. Should error if no package.json found
2. Should error if no convex/ directory found
3. Should error if env file not found (non-dry-run)
4. Should display dry-run information without executing
5. Should execute rollback command when --rollback is set
6. Should deploy successfully with confirmation
7. Should deploy without confirmation when --force is set
8. Should handle deployment failure gracefully
9. Should push environment variables before deploying

## Dependencies

- `node:child_process` (execSync)
- `fs-extra` (file system operations)
- `dotenv` (parse .env files)
