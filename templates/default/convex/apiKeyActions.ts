"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

export const testKey = action({
  args: {
    provider: v.string(),
    keyValue: v.string(),
  },
  handler: async (_ctx, args): Promise<{ ok: boolean; error?: string; latencyMs: number }> => {
    const start = Date.now();
    try {
      if (args.provider === "openai" || args.provider === "openrouter") {
        const baseURL =
          args.provider === "openrouter"
            ? "https://openrouter.ai/api/v1"
            : "https://api.openai.com/v1";
        const resp = await fetch(`${baseURL}/models`, {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "anthropic") {
        const resp = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": args.keyValue,
            "anthropic-version": "2023-06-01",
          },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "google") {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${args.keyValue}`
        );
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "mistral") {
        const resp = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "deepseek") {
        const resp = await fetch("https://api.deepseek.com/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "xai") {
        const resp = await fetch("https://api.x.ai/v1/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "groq") {
        const resp = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "together") {
        const resp = await fetch("https://api.together.xyz/v1/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "perplexity") {
        const resp = await fetch("https://api.perplexity.ai/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else {
        throw new Error(`Provider ${args.provider} not supported for testing`);
      }

      return { ok: true, latencyMs: Date.now() - start };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - start,
      };
    }
  },
});
