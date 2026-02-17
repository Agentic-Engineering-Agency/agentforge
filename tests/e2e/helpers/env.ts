/**
 * E2E Test Environment Configuration
 *
 * Centralises all environment variable access and provides typed configuration
 * for the E2E test suite. Supports both local docker-compose and remote Cloud.
 */

export interface TestConfig {
  /** URL of the AgentForge Cloud API (e.g. http://localhost:3001) */
  cloudUrl: string;

  /** URL of the Convex backend (e.g. http://localhost:3210) */
  convexUrl: string;

  /** API key for authenticated Cloud requests */
  apiKey: string;

  /** OpenAI API key for local agent execution (BYOK) */
  openaiKey: string;

  /** Whether to skip tests that require real LLM calls */
  skipLlmTests: boolean;

  /** Whether we're running in CI */
  isCi: boolean;

  /** Test user ID to scope all operations */
  testUserId: string;
}

/**
 * Resolves environment variables with fallbacks for local dev.
 */
export function getTestConfig(): TestConfig {
  return {
    cloudUrl: process.env.AGENTFORGE_CLOUD_URL ?? 'http://localhost:3001',
    convexUrl: process.env.CONVEX_URL ?? 'http://localhost:3210',
    apiKey: process.env.AGENTFORGE_TEST_API_KEY ?? 'test-api-key-e2e',
    openaiKey: process.env.OPENAI_API_KEY ?? '',
    skipLlmTests: !process.env.OPENAI_API_KEY,
    isCi: process.env.CI === 'true',
    testUserId: process.env.E2E_TEST_USER_ID ?? 'e2e-test-user',
  };
}

/**
 * Asserts that an env var is set; throws a descriptive error if not.
 */
export function ensureEnv(name: string, value: string | undefined): asserts value is string {
  if (!value) {
    throw new Error(
      `[E2E] Required environment variable ${name} is not set.\n` +
        `Set it in your shell or in tests/.env.e2e`
    );
  }
}

/**
 * Returns true if LLM-dependent tests should run.
 * Skips gracefully in CI where no API key is configured.
 */
export function canRunLlmTests(): boolean {
  return !getTestConfig().skipLlmTests;
}
