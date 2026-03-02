import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Convex supports process.env but doesn't ship Node types by default
declare const process: { env: Record<string, string | undefined> };

// ============================================================
// SECURE VAULT - AES-256-GCM Encrypted secrets management
// ============================================================

// Helper: Convert string to ArrayBuffer
function str2ab(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

// Helper: Convert ArrayBuffer to string
function ab2str(buf: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buf);
}

// Helper: Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Get or generate per-deployment salt for key derivation
function getVaultSalt(): ArrayBuffer {
  const storedSalt = process.env.VAULT_SALT;

  if (storedSalt && storedSalt.length >= 16) {
    // Use the provided salt from environment variable
    return str2ab(storedSalt);
  }

  // Generate a random salt (this should be persisted to VAULT_SALT in production)
  const randomSalt = crypto.getRandomValues(new Uint8Array(16));
  console.warn(
    'WARNING: VAULT_SALT not set or too short. Using ephemeral random salt. ' +
    'Encrypted data will be inaccessible after restart! ' +
    'Generate a persistent salt with: openssl rand -base64 16'
  );
  return randomSalt.buffer;
}

// Helper: Derive a cryptographic key from a string
async function deriveKey(keyString: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    str2ab(keyString),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Use a unique per-deployment salt for key derivation
  const salt = getVaultSalt();

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

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
// This is now MANDATORY - the vault will not work without it.
function getEncryptionKey(): string {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "VAULT_ENCRYPTION_KEY must be set in environment variables and be at least 32 characters long. " +
      "Set this in your Convex dashboard under Settings > Environment Variables."
    );
  }
  return key;
}

// AES-256-GCM encryption for secure secret storage.
// Each encryption uses a unique IV (Initialization Vector) for security.
async function encodeSecret(value: string, keyString: string): Promise<{ encrypted: string; iv: string }> {
  const key = await deriveKey(keyString);

  // Generate a unique IV for each encryption (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the value
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    str2ab(value)
  );

  // Return base64-encoded encrypted data and IV
  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

// AES-256-GCM decryption for secure secret retrieval.
async function decodeSecret(encryptedB64: string, ivB64: string, keyString: string): Promise<string> {
  const key = await deriveKey(keyString);

  const encrypted = base64ToArrayBuffer(encryptedB64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64));

  // Decrypt the value
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encrypted
  );

  return ab2str(decrypted);
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
    const { encrypted, iv } = await encodeSecret(args.value, key);
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
    const { encrypted, iv } = await encodeSecret(args.value, key);
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
      const { encrypted, iv } = await encodeSecret(args.value, key);
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
    const decrypted = await decodeSecret(entry.encryptedValue, entry.iv, key);
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
          const { encrypted, iv } = await encodeSecret(secretValue, key);
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
