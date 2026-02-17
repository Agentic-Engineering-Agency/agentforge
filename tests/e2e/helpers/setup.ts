/**
 * E2E Test Suite — Global Setup
 *
 * Validates that all required environment variables and services are available
 * before any test runs. Provides clear diagnostic errors if something is missing.
 */

import { beforeAll, afterAll } from 'vitest';
import { CloudTestClient } from './cloud-client.js';
import { ensureEnv, getTestConfig } from './env.js';

// ─── Pre-flight checks ──────────────────────────────────────────────────────

beforeAll(async () => {
  const config = getTestConfig();

  // 1. Validate we have a Cloud API URL
  ensureEnv('AGENTFORGE_CLOUD_URL', config.cloudUrl);

  // 2. Validate we have a test API key
  ensureEnv('AGENTFORGE_TEST_API_KEY', config.apiKey);

  // 3. Check Cloud API is reachable
  const client = new CloudTestClient(config.cloudUrl, config.apiKey);
  const reachable = await client.healthCheck();

  if (!reachable) {
    throw new Error(
      `[E2E Setup] Cloud API is not reachable at ${config.cloudUrl}.\n` +
        'Start it with: docker compose -f tests/docker-compose.e2e.yml up -d\n' +
        'Or set AGENTFORGE_CLOUD_URL to a running instance.'
    );
  }

  console.log(`✅ E2E Setup: Cloud API reachable at ${config.cloudUrl}`);
});

afterAll(async () => {
  // Cleanup: remove any test artifacts
  const config = getTestConfig();
  const client = new CloudTestClient(config.cloudUrl, config.apiKey);

  try {
    await client.cleanupTestAgents();
    console.log('🧹 E2E Teardown: Test agents cleaned up');
  } catch {
    // Non-fatal — tests may already have cleaned up
  }
});
