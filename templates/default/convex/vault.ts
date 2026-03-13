import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Crypto operations (encrypt/decrypt secrets) are in vaultCrypto.ts ("use node").
// This file contains only V8-safe queries and mutations — no crypto.subtle.

// Secret pattern detection for auto-capture from chat
const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, category: "api_key", provider: "openai", name: "OpenAI API Key" },
  { pattern: /sk-ant-[a-zA-Z0-9-]{20,}/, category: "api_key", provider: "anthropic", name: "Anthropic API Key" },
  { pattern: /sk-or-[a-zA-Z0-9]{20,}/, category: "api_key", provider: "openrouter", name: "OpenRouter API Key" },
  { pattern: /AIza[a-zA-Z0-9_-]{35}/, category: "api_key", provider: "google", name: "Google API Key" },
  { pattern: /xai-[a-zA-Z0-9]{20,}/, category: "api_key", provider: "xai", name: "xAI API Key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, category: "token", provider: "github", name: "GitHub Personal Access Token" },
  { pattern: /gho_[a-zA-Z0-9]{36}/, category: "token", provider: "github", name: "GitHub OAuth Token" },
  { pattern: /glpat-[a-zA-Z0-9_-]{20,}/, category: "token", provider: "gitlab", name: "GitLab Personal Access Token" },
  { pattern: /xoxb-[a-zA-Z0-9-]+/, category: "token", provider: "slack", name: "Slack Bot Token" },
  { pattern: /xoxp-[a-zA-Z0-9-]+/, category: "token", provider: "slack", name: "Slack User Token" },
  { pattern: /AKIA[A-Z0-9]{16}/, category: "credential", provider: "aws", name: "AWS Access Key ID" },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, category: "api_key", provider: "stripe", name: "Stripe Live Secret Key" },
  { pattern: /sk_test_[a-zA-Z0-9]{24,}/, category: "api_key", provider: "stripe", name: "Stripe Test Secret Key" },
  { pattern: /pk_live_[a-zA-Z0-9]{24,}/, category: "api_key", provider: "stripe", name: "Stripe Live Publishable Key" },
  { pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/, category: "api_key", provider: "sendgrid", name: "SendGrid API Key" },
  { pattern: /[a-f0-9]{32}-us[0-9]{1,2}/, category: "api_key", provider: "mailchimp", name: "Mailchimp API Key" },
  { pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, category: "secret", provider: "ssh", name: "Private Key" },
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, category: "token", provider: "jwt", name: "JWT Token" },
];

// Mask a secret value for display (show first 4 and last 4 chars)
function maskSecret(value: string): string {
  if (value.length <= 12) {
    return value.substring(0, 3) + "..." + value.substring(value.length - 3);
  }
  return value.substring(0, 6) + "..." + value.substring(value.length - 4);
}

// ---- Queries ----

export const list = query({
  args: {
    userId: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let entries;
    if (args.userId) {
      entries = await ctx.db
        .query("vault")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .collect();
    } else {
      entries = await ctx.db.query("vault").order("desc").collect();
    }

    if (args.category) {
      entries = entries.filter((e) => e.category === args.category);
    }

    // Never return encrypted values - only masked
    return entries.map((entry) => ({
      _id: entry._id,
      name: entry.name,
      category: entry.category,
      provider: entry.provider,
      maskedValue: entry.maskedValue,
      isActive: entry.isActive,
      expiresAt: entry.expiresAt,
      lastAccessedAt: entry.lastAccessedAt,
      accessCount: entry.accessCount,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
  },
});

export const getAuditLog = query({
  args: {
    vaultEntryId: v.optional(v.id("vault")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    if (args.vaultEntryId) {
      return await ctx.db
        .query("vaultAuditLog")
        .withIndex("byVaultEntryId", (q) => q.eq("vaultEntryId", args.vaultEntryId!))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("vaultAuditLog").order("desc").take(limit);
  },
});

/**
 * Internal: Get raw vault entry including encrypted value.
 * Only used by vaultCrypto for decryption.
 */
export const getRawEntry = internalQuery({
  args: { id: v.id("vault") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ---- Mutations ----

/**
 * Insert an already-encrypted vault entry.
 * Called by vaultCrypto.encryptAndStore after encryption in Node.js.
 */
export const insertEncrypted = internalMutation({
  args: {
    name: v.string(),
    category: v.string(),
    provider: v.optional(v.string()),
    encryptedValue: v.string(),
    iv: v.string(),
    maskedValue: v.string(),
    userId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("vault", {
      name: args.name,
      category: args.category,
      provider: args.provider,
      encryptedValue: args.encryptedValue,
      iv: args.iv,
      maskedValue: args.maskedValue,
      isActive: true,
      expiresAt: args.expiresAt,
      accessCount: 0,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("vaultAuditLog", {
      vaultEntryId: id,
      action: args.source === "chat" ? "auto_captured" : "created",
      source: args.source,
      userId: args.userId,
      timestamp: now,
    });

    return id;
  },
});

/**
 * Update an encrypted vault entry value.
 * Called by vaultCrypto.reEncrypt after re-encryption in Node.js.
 */
export const updateEncryptedValue = internalMutation({
  args: {
    id: v.id("vault"),
    encryptedValue: v.string(),
    iv: v.string(),
    maskedValue: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      encryptedValue: args.encryptedValue,
      iv: args.iv,
      maskedValue: args.maskedValue,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("vaultAuditLog", {
      vaultEntryId: args.id,
      action: "updated",
      source: "dashboard",
      userId: args.userId,
      timestamp: Date.now(),
    });
  },
});

/**
 * Record a vault access event (for audit log).
 * Called by vaultCrypto.decryptSecret after decryption.
 */
export const recordAccess = internalMutation({
  args: {
    id: v.id("vault"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) return;

    await ctx.db.patch(args.id, {
      lastAccessedAt: Date.now(),
      accessCount: entry.accessCount + 1,
    });

    await ctx.db.insert("vaultAuditLog", {
      vaultEntryId: args.id,
      action: "accessed",
      source: "agent",
      userId: args.userId,
      timestamp: Date.now(),
    });
  },
});

/**
 * Public mutation stubs kept for backward compatibility.
 * Encryption must happen in Node.js actions via vaultCrypto.
 */
export const store = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    provider: v.optional(v.string()),
    value: v.string(),
    userId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (_ctx, _args) => {
    throw new Error(
      "Direct vault.store is deprecated. Use vaultCrypto.encryptAndStore internalAction instead."
    );
  },
});

export const update = mutation({
  args: {
    id: v.id("vault"),
    name: v.optional(v.string()),
    value: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vault entry not found");

    if (args.value) {
      throw new Error(
        "Cannot re-encrypt in V8 mutation. Use vaultCrypto.reEncrypt internalAction instead."
      );
    }

    // Non-crypto updates can proceed in the mutation
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.expiresAt !== undefined) updates.expiresAt = args.expiresAt;

    await ctx.db.patch(args.id, updates);

    await ctx.db.insert("vaultAuditLog", {
      vaultEntryId: args.id,
      action: "updated",
      source: "dashboard",
      userId: args.userId,
      timestamp: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("vault"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vault entry not found");

    await ctx.db.insert("vaultAuditLog", {
      vaultEntryId: args.id,
      action: "deleted",
      source: "dashboard",
      userId: args.userId,
      timestamp: Date.now(),
    });

    await ctx.db.delete(args.id);
  },
});

// ---- Secret Detection Utility ----

export const detectSecrets = internalQuery({
  args: { text: v.string() },
  handler: async (_ctx, args) => {
    const detected: Array<{
      match: string;
      category: string;
      provider: string;
      name: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    for (const { pattern, category, provider, name } of SECRET_PATTERNS) {
      const regex = new RegExp(pattern, "g");
      let match;
      while ((match = regex.exec(args.text)) !== null) {
        detected.push({
          match: match[0],
          category,
          provider,
          name,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    return detected;
  },
});

// Censor a message by replacing detected secrets with masked versions
// and scheduling encrypted storage in the vault via vaultCrypto.
export const censorMessage = mutation({
  args: {
    text: v.string(),
    userId: v.optional(v.string()),
    autoStore: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let censoredText = args.text;
    const storedSecrets: Array<{ name: string; masked: string }> = [];

    for (const { pattern, category, provider, name } of SECRET_PATTERNS) {
      const regex = new RegExp(pattern, "g");
      let match;
      while ((match = regex.exec(args.text)) !== null) {
        const secretValue = match[0];
        const masked = maskSecret(secretValue);

        censoredText = censoredText.replace(secretValue, `[REDACTED: ${masked}]`);

        if (args.autoStore !== false) {
          // Delegate encryption to Node.js action (fire-and-forget)
          await ctx.scheduler.runAfter(0, internal.vaultCrypto.encryptAndStore, {
            name: `${name} (auto-captured)`,
            category,
            provider,
            value: secretValue,
            userId: args.userId,
            source: "chat",
          });

          storedSecrets.push({ name, masked });
        }
      }
    }

    return {
      censoredText,
      secretsDetected: storedSecrets.length > 0,
      storedSecrets,
      originalHadSecrets: censoredText !== args.text,
    };
  },
});
