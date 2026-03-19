/**
 * Environment variable validation for AgentForge daemon.
 *
 * Fails fast on missing required environment variables and warns
 * about optional variables needed for specific features.
 */

/**
 * Custom error for environment validation failures.
 */
export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Required environment variables.
 *
 * These must be present for the daemon to start.
 */
const REQUIRED_VARS: Record<
  string,
  { description: string; validate?: (value: string) => boolean }
> = {
  AGENTFORGE_KEY_SALT: {
    description: "Required for API key encryption (min 32 chars)",
    validate: (value) => value.length >= 32,
  },
};

/**
 * Optional environment variables.
 *
 * These are only required when specific features are enabled.
 */
const OPTIONAL_VARS: Record<string, { description: string; requiredFor: string[] }> = {
  DISCORD_BOT_TOKEN: {
    description: "Discord bot token for Discord channel",
    requiredFor: ["discord"],
  },
  TELEGRAM_BOT_TOKEN: {
    description: "Telegram bot token for Telegram channel",
    requiredFor: ["telegram"],
  },
  AGENTFORGE_API_KEY: {
    description: "API key for HTTP channel authentication",
    requiredFor: ["http"],
  },
};

/**
 * Channel configuration for validation.
 */
export interface ChannelConfig {
  channels: string[];
}

/**
 * Validate environment variables.
 *
 * Throws EnvValidationError if required variables are missing or invalid.
 * Warns (but does not throw) if optional variables are missing for enabled channels.
 *
 * @param config - Channel configuration to determine which optional vars to check
 * @throws EnvValidationError with helpful message if validation fails
 */
export function validateEnv(config: ChannelConfig): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
    const value = process.env[varName];

    if (!value) {
      errors.push(`${varName}: ${config.description}`);
    } else if (config.validate && !config.validate(value)) {
      errors.push(`${varName}: validation failed - ${config.description}`);
    }
  }

  // Check optional variables for enabled channels
  for (const [varName, optConfig] of Object.entries(OPTIONAL_VARS)) {
    const isEnabled = optConfig.requiredFor.some((channel) =>
      config.channels.includes(channel)
    );

    if (isEnabled && !process.env[varName]) {
      warnings.push(
        `${varName} is required for ${optConfig.requiredFor.join(", ")} channel(s) - ${optConfig.description}`
      );
    }
  }

  // Explicit warning for unauthenticated HTTP mode
  if (!process.env.AGENTFORGE_API_KEY) {
    warnings.push(
      'AGENTFORGE_API_KEY not set — HTTP channel will run without authentication'
    );
  }

  // Log warnings
  for (const warning of warnings) {
    console.warn(`[WARN] ${warning}`);
  }

  // Throw if there are errors
  if (errors.length > 0) {
    const message = `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
    throw new EnvValidationError(message);
  }
}
