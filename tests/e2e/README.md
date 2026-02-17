# E2E Integration Tests — Framework → Cloud

> **GitHub Issue:** [AF-30](https://github.com/Agentic-Engineering-Agency/agentforge/issues/30)

End-to-end tests that validate the complete AgentForge journey: **local development → deployment → cloud execution**.

## Test Suite Overview

| Test File | What It Validates | Infra Needed |
|---|---|---|
| `local.test.ts` | Agent creation, generate, stream, tools, workspace | None (mocked LLM) |
| `deploy.test.ts` | CLI deploy pipeline, env parsing, rollback, Cloud registration | Cloud API |
| `cloud-execution.test.ts` | Agent runs on Cloud, consistency, concurrency, usage tracking | Cloud API |
| `threads.test.ts` | Thread creation, multi-turn, isolation, message ordering | Cloud API |
| `tools.test.ts` | MCPServer tools, schema validation, serialization, workspace | Partial Cloud |

## Quick Start

### 1. Run local tests (no infrastructure needed)

```bash
# From repo root
pnpm build
cd tests/e2e
npx vitest run local.test.ts tools.test.ts --config vitest.config.ts
```

### 2. Run full suite with Cloud

```bash
# Start local Cloud infrastructure
docker compose -f tests/docker-compose.e2e.yml up -d

# Wait for services
sleep 10

# Configure test environment
cp .env.e2e.example .env.e2e
# Edit .env.e2e if needed

# Run all tests
npx vitest run --config vitest.config.ts

# Teardown
docker compose -f tests/docker-compose.e2e.yml down -v
```

### 3. Run with coverage

```bash
npx vitest run --config vitest.config.ts --coverage
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AGENTFORGE_CLOUD_URL` | For cloud tests | `http://localhost:3001` | Cloud API endpoint |
| `CONVEX_URL` | For cloud tests | `http://localhost:3210` | Convex backend URL |
| `AGENTFORGE_TEST_API_KEY` | For cloud tests | `test-api-key-e2e` | API authentication |
| `OPENAI_API_KEY` | Optional | — | Enables real LLM tests |
| `E2E_TEST_USER_ID` | No | `e2e-test-user` | Scopes test data |

## Architecture

```
tests/e2e/
├── helpers/
│   ├── setup.ts          # Global setup (pre-flight checks)
│   ├── env.ts            # Environment config
│   ├── cloud-client.ts   # Cloud API HTTP client
│   └── fixtures.ts       # Agent configs, prompts, tools
├── local.test.ts         # Test 1: Local agent execution
├── deploy.test.ts        # Test 2: Deploy to Cloud
├── cloud-execution.test.ts # Test 3: Cloud execution
├── threads.test.ts       # Test 4: Thread continuity
├── tools.test.ts         # Test 5: Tools & workspace
├── vitest.config.ts      # Test runner config
├── .env.e2e.example      # Example env file
├── README.md             # This file
└── docker-compose.e2e.yml # Local Cloud infra (in parent)
```

## CI/CD

Tests run automatically via GitHub Actions (`.github/workflows/e2e.yml`):

1. **Stage 1 — Local tests:** No infrastructure, runs always
2. **Stage 2 — Cloud tests:** Spins up Convex + Cloud API in GH Actions services
3. **Stage 3 — Coverage:** Generates and uploads coverage report

### Skip Cloud tests in CI

Use workflow dispatch with `skip_cloud_tests: true` to run only local tests.

## Writing New Tests

### Adding a test

1. Create `tests/e2e/your-feature.test.ts`
2. Import helpers: `env.ts`, `cloud-client.ts`, `fixtures.ts`
3. Add your test agent config to `fixtures.ts` if needed
4. Use `uniqueTestId()` for all agent/thread IDs (prevents collisions)
5. Clean up test data in `afterAll()`

### Test agent naming

All test agents are prefixed with `e2e-test-` automatically by `CloudTestClient`. This:
- Prevents collisions with real agents
- Enables bulk cleanup via `cleanupTestAgents()`
- Makes test data easy to identify in the Cloud dashboard

### Best practices

- **Don't depend on LLM output content** — agent responses are non-deterministic
- **Do verify structure** — response shape, presence of fields, types
- **Use `uniqueTestId()`** — prevents test interference
- **Clean up in `afterAll()`** — don't leave test data in Cloud
- **Check `canRunLlmTests()`** before making real API calls

## Troubleshooting

### "Cloud API is not reachable"

```bash
# Check if docker-compose is running
docker compose -f tests/docker-compose.e2e.yml ps

# Check Cloud API logs
docker compose -f tests/docker-compose.e2e.yml logs agentforge-cloud-api

# Restart
docker compose -f tests/docker-compose.e2e.yml restart
```

### "CONVEX_URL not found"

Set the environment variable:
```bash
export CONVEX_URL=http://localhost:3210
```

### Tests timing out

Increase timeout in `vitest.config.ts`:
```typescript
test: {
  testTimeout: 180_000, // 3 minutes
}
```

### Flaky concurrent tests

Cloud tests run sequentially (`singleFork: true`). If you still see flakiness,
add explicit waits between Cloud API calls:
```typescript
await new Promise(r => setTimeout(r, 500));
```
