import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// ============================================================
// SECURE VAULT - Encrypted secrets management
// ============================================================

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

// Encryption key from Convex environment variable.
// Set VAULT_ENCRYPTION_KEY in your Convex dashboard under Settings > Environment Variables.
// If not set, a default key is used (NOT SECURE for production).
function getEncryptionKey(): string {
  return process.env.VAULT_ENCRYPTION_KEY ?? "agentforge-default-key-set-env-var";
}

// XOR-based encoding with per-entry IV for database obfuscation.
// For production deployments with sensitive data, consider integrating
// with a proper KMS (e.g., AWS KMS, Cloudflare Workers Secrets).
function encodeSecret(value: string, key: string): { encrypted: string; iv: string } {
  const iv = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  ).join("");
  const combined = key + iv;
  let encrypted = "";
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i) ^ combined.charCodeAt(i % combined.length);
    encrypted += charCode.toString(16).padStart(4, "0");
  }
  return { encrypted, iv };
}

function decodeSecret(encrypted: string, iv: string, key: string): string {
  const combined = key + iv;
  let decoded = "";
  for (let i = 0; i < encrypted.length; i += 4) {
    const charCode =
      parseInt(encrypted.substring(i, i + 4), 16) ^
      combined.charCodeAt((i / 4) % combined.length);
    decoded += String.fromCharCode(charCode);
  }
  return decoded;
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

// ---- Mutations ----

export const store = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    provider: v.optional(v.string()),
    value: v.string(),
    userId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const key = getEncryptionKey();
    const { encrypted, iv } = encodeSecret(args.value, key);
    const masked = maskSecret(args.value);
    const now = Date.now();

    const id = await ctx.db.insert("vault", {
      name: args.name,
      category: args.category,
      provider: args.provider,
      encryptedValue: encrypted,
      iv,
      maskedValue: masked,
      isActive: true,
      expiresAt: args.expiresAt,
      accessCount: 0,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("vaultAuditLog", {
      vaultEntryId: id,
      action: "created",
      source: "dashboard",
      userId: args.userId,
      timestamp: now,
    });

    return id;
  },
});

export const storeFromChat = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    provider: v.optional(v.string()),
    value: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = getEncryptionKey();
    const { encrypted, iv } = encodeSecret(args.value, key);
    const masked = maskSecret(args.value);
    const now = Date.now();

    const id = await ctx.db.insert("vault", {
      name: args.name,
      category: args.category,
      provider: args.provider,
      encryptedValue: encrypted,
      iv,
      maskedValue: masked,
      isActive: true,
      accessCount: 0,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("vaultAuditLog", {
      vaultEntryId: id,
      action: "auto_captured",
      source: "chat",
      userId: args.userId,
      timestamp: now,
    });

    return { id, masked };
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

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.expiresAt !== undefined) updates.expiresAt = args.expiresAt;

    if (args.value) {
      const key = getEncryptionKey();
      const { encrypted, iv } = encodeSecret(args.value, key);
      updates.encryptedValue = encrypted;
      updates.iv = iv;
      updates.maskedValue = maskSecret(args.value);
    }

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

// Internal-only: Retrieve decrypted value (only callable from other Convex functions)
export const retrieveSecret = internalMutation({
  args: {
    id: v.id("vault"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Vault entry not found");
    if (!entry.isActive) throw new Error("Vault entry is disabled");

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

    const key = getEncryptionKey();
    const decrypted = decodeSecret(entry.encryptedValue, entry.iv, key);
    return decrypted;
  },
});

// ---- Secret Detection Utility ----

export const detectSecrets = query({
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
export const censorMessage = mutation({
  args: {
    text: v.string(),
    userId: v.optional(v.string()),
    autoStore: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let censoredText = args.text;
    const storedSecrets: Array<{ name: string; masked: string; id: unknown }> = [];

    for (const { pattern, category, provider, name } of SECRET_PATTERNS) {
      const regex = new RegExp(pattern, "g");
      let match;
      while ((match = regex.exec(args.text)) !== null) {
        const secretValue = match[0];
        const masked = maskSecret(secretValue);

        censoredText = censoredText.replace(secretValue, `[REDACTED: ${masked}]`);

        if (args.autoStore !== false) {
          const key = getEncryptionKey();
          const { encrypted, iv } = encodeSecret(secretValue, key);
          const now = Date.now();

          const id = await ctx.db.insert("vault", {
            name: `${name} (auto-captured)`,
            category,
            provider,
            encryptedValue: encrypted,
            iv,
            maskedValue: masked,
            isActive: true,
            accessCount: 0,
            userId: args.userId,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("vaultAuditLog", {
            vaultEntryId: id,
            action: "auto_captured",
            source: "chat",
            userId: args.userId,
            timestamp: now,
          });

          storedSecrets.push({ name, masked, id });
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
