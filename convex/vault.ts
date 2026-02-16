import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

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

// Simple XOR-based encoding (in production, use proper AES-256-GCM with a KMS)
// This provides a layer of obfuscation in the database
function encodeSecret(value: string, key: string): { encrypted: string; iv: string } {
  const iv = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
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
    const charCode = parseInt(encrypted.substring(i, i + 4), 16) ^ combined.charCodeAt((i / 4) % combined.length);
    decoded += String.fromCharCode(charCode);
  }
  return decoded;
}

// The encryption key should come from environment variables in production
const VAULT_ENCRYPTION_KEY = "agentforge-vault-key-change-in-production-2026";

// ---- Queries ----

export const list = query({
  args: {
    userId: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("vault");
    if (args.userId) {
      q = ctx.db.query("vault").withIndex("byUserId", (q) => q.eq("userId", args.userId));
    }
    const entries = await q.order("desc").take(100);
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
      return ctx.db
        .query("vaultAuditLog")
        .withIndex("byVaultEntryId", (q) => q.eq("vaultEntryId", args.vaultEntryId!))
        .order("desc")
        .take(limit);
    }
    return ctx.db.query("vaultAuditLog").order("desc").take(limit);
  },
});

// ---- Mutations ----

export const store = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    provider: v.optional(v.string()),
    value: v.string(), // Raw secret value - will be encrypted before storage
    userId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { encrypted, iv } = encodeSecret(args.value, VAULT_ENCRYPTION_KEY);
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
      lastAccessedAt: undefined,
      accessCount: 0,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
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
    const { encrypted, iv } = encodeSecret(args.value, VAULT_ENCRYPTION_KEY);
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

    // Audit log with auto_captured source
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

    const updates: any = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.expiresAt !== undefined) updates.expiresAt = args.expiresAt;

    if (args.value) {
      const { encrypted, iv } = encodeSecret(args.value, VAULT_ENCRYPTION_KEY);
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

    // Log deletion before removing
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

// Retrieve decrypted value (for internal agent use only - never expose to frontend)
export const retrieveSecret = mutation({
  args: {
    id: v.id("vault"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Vault entry not found");
    if (!entry.isActive) throw new Error("Vault entry is disabled");

    // Update access tracking
    await ctx.db.patch(args.id, {
      lastAccessedAt: Date.now(),
      accessCount: entry.accessCount + 1,
    });

    // Audit log
    await ctx.db.insert("vaultAuditLog", {
      vaultEntryId: args.id,
      action: "accessed",
      source: "agent",
      userId: args.userId,
      timestamp: Date.now(),
    });

    // Decrypt and return
    const decrypted = decodeSecret(entry.encryptedValue, entry.iv, VAULT_ENCRYPTION_KEY);
    return decrypted;
  },
});

// ---- Secret Detection Utility ----
// This is exported for use by the chat message handler

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
    const storedSecrets: Array<{ name: string; masked: string; id: any }> = [];

    for (const { pattern, category, provider, name } of SECRET_PATTERNS) {
      const regex = new RegExp(pattern, "g");
      let match;
      while ((match = regex.exec(args.text)) !== null) {
        const secretValue = match[0];
        const masked = maskSecret(secretValue);

        // Replace in censored text
        censoredText = censoredText.replace(secretValue, `[REDACTED: ${masked}]`);

        // Auto-store if enabled
        if (args.autoStore !== false) {
          const { encrypted, iv } = encodeSecret(secretValue, VAULT_ENCRYPTION_KEY);
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
