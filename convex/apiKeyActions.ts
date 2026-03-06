"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

// Provider probe configuration: endpoint URL builder and auth header builder
type ProbeResult = { ok: boolean; error?: string; latencyMs: number };

interface ProviderProbe {
  url: string | ((key: string) => string);
  headers: (key: string) => Record<string, string>;
}

const PROVIDER_PROBES: Record<string, ProviderProbe> = {
  openai: {
    url: "https://api.openai.com/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  },
  google: {
    url: (key: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    headers: () => ({}),
  },
  mistral: {
    url: "https://api.mistral.ai/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  deepseek: {
    url: "https://api.deepseek.com/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  xai: {
    url: "https://api.x.ai/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  groq: {
    url: "https://api.groq.com/openai/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  together: {
    url: "https://api.together.xyz/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  perplexity: {
    url: "https://api.perplexity.ai/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

/**
 * Probe a provider's API with the given key.
 * Returns ok=true if the provider returns a 2xx response.
 */
async function probeProviderKey(provider: string, keyValue: string): Promise<ProbeResult> {
  const probe = PROVIDER_PROBES[provider];
  if (!probe) {
    return { ok: true, latencyMs: 0 }; // Unknown provider — key is stored, assume ok
  }

  const url = typeof probe.url === "function" ? probe.url(keyValue) : probe.url;
  const headers = probe.headers(keyValue);
  const start = Date.now();
  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - start,
    };
  }
}

export const testKey = action({
  args: {
    provider: v.string(),
    keyValue: v.string(),
  },
  handler: async (_ctx, args): Promise<ProbeResult> => {
    return probeProviderKey(args.provider, args.keyValue);
  },
});

/**
 * Action: Test the stored API key for a provider without exposing the decrypted key to clients.
 *
 * Retrieves the key internally via getDecryptedForProvider, then runs a lightweight
 * probe against the provider's API to verify the key is valid.
 */
export const testStoredKey = action({
  args: {
    provider: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ProbeResult> => {
    const key = await ctx.runAction(internal.apiKeys.getDecryptedForProvider, {
      provider: args.provider,
      userId: args.userId,
    });

    if (!key) {
      return { ok: false, error: "No active API key found for this provider", latencyMs: 0 };
    }

    // Measure only the actual probe time, not key retrieval
    return probeProviderKey(args.provider, key);
  },
});

/**
 * Action: Create and store an API key with AES-256-GCM encryption.
 *
 * Encryption must happen in a Node.js action (not a mutation) because:
 * 1. Convex mutations run in a deterministic V8 environment — they cannot call
 *    non-deterministic operations such as crypto.randomBytes or external actions.
 * 2. Only actions have ctx.runAction; ctx.runAction is not available on mutations.
 *
 * Flow: action → encrypt (via apiKeysCrypto.encryptApiKey) → internal mutation (_insertKey)
 */
export const create = action({
  args: {
    provider: v.string(),
    keyName: v.string(),
    keyValue: v.string(), // Plaintext key — encrypted here before storage
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const encrypted = await ctx.runAction(internal.apiKeysCrypto.encryptApiKey, {
      plaintext: args.keyValue,
    });

    return await ctx.runMutation(internal.apiKeys._insertKey, {
      provider: args.provider,
      keyName: args.keyName,
      encryptedKey: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
      version: encrypted.version,
      isActive: true,
      userId: args.userId,
    });
  },
});

/**
 * Action: Update an existing API key, re-encrypting if a new key value is provided.
 *
 * See create() above for why encryption is done in an action, not a mutation.
 */
export const update = action({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    keyValue: v.optional(v.string()), // Plaintext key — encrypted here before storage
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, keyValue, ...rest } = args;

    if (keyValue !== undefined) {
      const encrypted = await ctx.runAction(internal.apiKeysCrypto.encryptApiKey, {
        plaintext: keyValue,
      });
      return await ctx.runMutation(internal.apiKeys._patchKey, {
        id,
        ...rest,
        encryptedKey: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        version: encrypted.version,
      });
    }

    return await ctx.runMutation(internal.apiKeys._patchKey, { id, ...rest });
  },
});
