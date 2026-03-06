import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { validateEnv, EnvValidationError } from "./validate-env";

describe("validate-env", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateEnv", () => {
    test("throws when AGENTFORGE_KEY_SALT is missing", () => {
      delete process.env.AGENTFORGE_KEY_SALT;

      expect(() => validateEnv({ channels: [] })).toThrow(EnvValidationError);
      expect(() => validateEnv({ channels: [] })).toThrow(
        "AGENTFORGE_KEY_SALT"
      );
      expect(() => validateEnv({ channels: [] })).toThrow(
        "Required for API key encryption"
      );
    });

    test("throws when AGENTFORGE_KEY_SALT is too short", () => {
      process.env.AGENTFORGE_KEY_SALT = "short";

      expect(() => validateEnv({ channels: [] })).toThrow(EnvValidationError);
      expect(() => validateEnv({ channels: [] })).toThrow(
        "AGENTFORGE_KEY_SALT"
      );
      expect(() => validateEnv({ channels: [] })).toThrow(
        "validation failed"
      );
    });

    test("does not throw when AGENTFORGE_KEY_SALT is valid", () => {
      process.env.AGENTFORGE_KEY_SALT =
        "agentforge-key-salt-32-characters-min";

      expect(() => validateEnv({ channels: [] })).not.toThrow();
    });

    test("warns but does not throw when DISCORD_BOT_TOKEN is missing but discord channel enabled", () => {
      process.env.AGENTFORGE_KEY_SALT =
        "agentforge-key-salt-32-characters-min";
      delete process.env.DISCORD_BOT_TOKEN;

      const consoleWarnSpy = vi.spyOn(console, "warn");

      expect(() => validateEnv({ channels: ["discord"] })).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("DISCORD_BOT_TOKEN")
      );
    });

    test("warns but does not throw when TELEGRAM_BOT_TOKEN is missing but telegram channel enabled", () => {
      process.env.AGENTFORGE_KEY_SALT =
        "agentforge-key-salt-32-characters-min";
      delete process.env.TELEGRAM_BOT_TOKEN;

      const consoleWarnSpy = vi.spyOn(console, "warn");

      expect(() => validateEnv({ channels: ["telegram"] })).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("TELEGRAM_BOT_TOKEN")
      );
    });

    test("does not warn when optional vars are present", () => {
      process.env.AGENTFORGE_KEY_SALT =
        "agentforge-key-salt-32-characters-min";
      process.env.DISCORD_BOT_TOKEN = "discord-test-token";
      process.env.TELEGRAM_BOT_TOKEN = "telegram-test-token";
      process.env.AGENTFORGE_API_KEY = "agentforge-api-key";

      const consoleWarnSpy = vi.spyOn(console, "warn");

      validateEnv({ channels: ["discord", "telegram"] });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test("throws validation error with helpful message", () => {
      delete process.env.AGENTFORGE_KEY_SALT;

      try {
        validateEnv({ channels: [] });
        expect.fail("Should have thrown EnvValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(EnvValidationError);
        if (error instanceof EnvValidationError) {
          expect(error.message).toContain("AGENTFORGE_KEY_SALT");
          expect(error.message).toContain("Required for API key encryption");
        }
      }
    });
  });
});
