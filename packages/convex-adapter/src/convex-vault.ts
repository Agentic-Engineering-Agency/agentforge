/**
 * ConvexVault - AES-256-GCM encrypted secrets management for Convex.
 *
 * Provides a secure key-value store for sensitive data (API keys, tokens,
 * credentials) using AES-256-GCM authenticated encryption. Designed to work
 * both as a standalone encryption utility and as a Convex-backed persistent
 * vault when provided with a database context.
 *
 * @example
 * ```typescript
 * import { ConvexVault } from '@agentforge-ai/convex-adapter';
 *
 * // Standalone encryption
 * const vault = new ConvexVault({ encryptionKey: 'my-secret-key' });
 * const encrypted = vault.encrypt('sk-secret-value');
 * const decrypted = vault.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
 *
 * // With Convex context (in a mutation)
 * const vault = new ConvexVault({ encryptionKey: 'my-secret-key' });
 * vault.setContext(ctx);
 * await vault.set('openai-key', 'sk-...');
 * const key = await vault.get('openai-key');
 * ```
 *
 * @packageDocumentation
 */

import type { ConvexMutationCtx, EncryptionResult, VaultConfig } from './types.js';

// Use dynamic import for crypto to support both Node and edge environments
let cryptoModule: typeof import('node:crypto') | null = null;

/**
 * Lazily loads the Node.js crypto module.
 * Falls back to a polyfill-like approach if not available.
 */
async function getCrypto(): Promise<typeof import('node:crypto')> {
  if (!cryptoModule) {
    cryptoModule = await import('node:crypto');
  }
  return cryptoModule;
}

/**
 * Synchronously gets the crypto module (assumes it's been loaded).
 * Used internally after initial async load.
 */
function getCryptoSync(): typeof import('node:crypto') {
  if (!cryptoModule) {
    // Synchronous fallback for Node.js
    cryptoModule = require('node:crypto');
  }
  return cryptoModule!;
}

/**
 * Derives a 256-bit encryption key from a passphrase using SHA-256.
 *
 * @param passphrase - The passphrase to derive the key from.
 * @returns A 32-byte Buffer suitable for AES-256.
 */
function deriveKey(passphrase: string): Buffer {
  const crypto = getCryptoSync();
  return crypto.createHash('sha256').update(passphrase).digest();
}

/**
 * Masks a secret value for safe display.
 *
 * @param value - The secret to mask.
 * @returns A masked version showing only prefix and suffix.
 *
 * @example
 * ```
 * maskValue('sk-1234567890abcdef')
 * // Returns: 'sk-123...cdef'
 * ```
 */
export function maskValue(value: string): string {
  if (value.length <= 8) {
    return value.substring(0, 2) + '...' + value.substring(value.length - 2);
  }
  if (value.length <= 12) {
    return value.substring(0, 3) + '...' + value.substring(value.length - 3);
  }
  return value.substring(0, 6) + '...' + value.substring(value.length - 4);
}

/**
 * AES-256-GCM encrypted vault for Convex applications.
 *
 * Supports two modes of operation:
 * 1. **Standalone**: Encrypt/decrypt values without Convex storage.
 * 2. **Convex-backed**: Store encrypted secrets in Convex via set/get.
 *
 * AES-256-GCM provides both confidentiality and authenticity, protecting
 * against both eavesdropping and tampering attacks.
 */
export class ConvexVault {
  /** The derived 256-bit encryption key. */
  private encryptionKey: Buffer;

  /** Optional Convex mutation context for database operations. */
  private mutationCtx: ConvexMutationCtx | null = null;

  /** In-memory cache for encrypted entries when no Convex context is available. */
  private memoryStore: Map<
    string,
    { ciphertext: string; iv: string; authTag: string; maskedValue: string }
  > = new Map();

  /**
   * Creates a new ConvexVault instance.
   *
   * @param config - Optional vault configuration.
   *   - `encryptionKey`: Custom encryption passphrase. Defaults to
   *     VAULT_ENCRYPTION_KEY env var or a built-in default (NOT secure for production).
   *
   * @example
   * ```typescript
   * // Using environment variable
   * const vault = new ConvexVault();
   *
   * // Using explicit key
   * const vault = new ConvexVault({ encryptionKey: 'my-32-char-secret-key' });
   * ```
   */
  constructor(config?: VaultConfig) {
    const passphrase =
      config?.encryptionKey ??
      (typeof process !== 'undefined' ? process.env?.VAULT_ENCRYPTION_KEY : undefined) ??
      'agentforge-default-key-change-in-production';

    this.encryptionKey = deriveKey(passphrase);
  }

  /**
   * Sets the Convex mutation context for database-backed operations.
   *
   * When a context is set, set() and get() will use Convex tables
   * for persistence instead of in-memory storage.
   *
   * @param ctx - A Convex MutationCtx.
   */
  setContext(ctx: ConvexMutationCtx): void {
    this.mutationCtx = ctx;
  }

  /**
   * Encrypts a plaintext value using AES-256-GCM.
   *
   * @param value - The plaintext to encrypt.
   * @returns An object containing the ciphertext, IV, and auth tag (all hex-encoded).
   *
   * @example
   * ```typescript
   * const result = vault.encrypt('sk-my-api-key');
   * // { ciphertext: '...', iv: '...', authTag: '...' }
   * ```
   */
  encrypt(value: string): EncryptionResult {
    const crypto = getCryptoSync();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let ciphertext = cipher.update(value, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Decrypts a ciphertext using AES-256-GCM.
   *
   * @param ciphertext - The hex-encoded ciphertext.
   * @param iv - The hex-encoded initialization vector.
   * @param authTag - The hex-encoded GCM authentication tag.
   * @returns The decrypted plaintext.
   * @throws {Error} If decryption fails (wrong key, tampered data, etc.).
   *
   * @example
   * ```typescript
   * const plaintext = vault.decrypt(result.ciphertext, result.iv, result.authTag);
   * ```
   */
  decrypt(ciphertext: string, iv: string, authTag: string): string {
    const crypto = getCryptoSync();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Stores an encrypted secret by key.
   *
   * If a Convex MutationCtx is set, persists to the vault table.
   * Otherwise, stores in the in-memory cache.
   *
   * @param key - The unique key for the secret.
   * @param value - The plaintext secret value.
   *
   * @example
   * ```typescript
   * await vault.set('openai-key', 'sk-abc123...');
   * ```
   */
  async set(key: string, value: string): Promise<void> {
    if (!key) {
      throw new Error('Vault key must be a non-empty string.');
    }
    if (value === undefined || value === null) {
      throw new Error('Vault value must not be null or undefined.');
    }

    const { ciphertext, iv, authTag } = this.encrypt(value);
    const masked = maskValue(value);

    if (this.mutationCtx) {
      // Check if entry already exists
      const existing = await this.mutationCtx.db
        .query('vault')
        .filter((q: any) => q.eq(q.field('name'), key))
        .first();

      if (existing) {
        await this.mutationCtx.db.patch(existing._id, {
          encryptedValue: ciphertext,
          iv,
          authTag,
          maskedValue: masked,
          updatedAt: Date.now(),
        });
      } else {
        await this.mutationCtx.db.insert('vault', {
          name: key,
          category: 'secret',
          encryptedValue: ciphertext,
          iv,
          authTag,
          maskedValue: masked,
          isActive: true,
          accessCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    } else {
      this.memoryStore.set(key, { ciphertext, iv, authTag, maskedValue: masked });
    }
  }

  /**
   * Retrieves and decrypts a secret by key.
   *
   * @param key - The key of the secret to retrieve.
   * @returns The decrypted plaintext, or null if not found.
   *
   * @example
   * ```typescript
   * const apiKey = await vault.get('openai-key');
   * if (apiKey) {
   *   // Use the key
   * }
   * ```
   */
  async get(key: string): Promise<string | null> {
    if (!key) {
      throw new Error('Vault key must be a non-empty string.');
    }

    if (this.mutationCtx) {
      const entry = await this.mutationCtx.db
        .query('vault')
        .filter((q: any) => q.eq(q.field('name'), key))
        .first();

      if (!entry || !entry.isActive) {
        return null;
      }

      // Update access tracking
      await this.mutationCtx.db.patch(entry._id, {
        lastAccessedAt: Date.now(),
        accessCount: (entry.accessCount || 0) + 1,
      });

      return this.decrypt(entry.encryptedValue, entry.iv, entry.authTag);
    }

    const stored = this.memoryStore.get(key);
    if (!stored) {
      return null;
    }

    return this.decrypt(stored.ciphertext, stored.iv, stored.authTag);
  }

  /**
   * Deletes a secret by key.
   *
   * @param key - The key of the secret to delete.
   * @returns Whether the secret was found and deleted.
   */
  async delete(key: string): Promise<boolean> {
    if (!key) {
      throw new Error('Vault key must be a non-empty string.');
    }

    if (this.mutationCtx) {
      const entry = await this.mutationCtx.db
        .query('vault')
        .filter((q: any) => q.eq(q.field('name'), key))
        .first();

      if (entry) {
        await this.mutationCtx.db.delete(entry._id);
        return true;
      }
      return false;
    }

    return this.memoryStore.delete(key);
  }

  /**
   * Lists all stored secret keys (without decrypting values).
   *
   * @returns An array of objects with key names and masked values.
   */
  async list(): Promise<Array<{ key: string; maskedValue: string }>> {
    if (this.mutationCtx) {
      const entries = await this.mutationCtx.db.query('vault').collect();
      return entries
        .filter((e: any) => e.isActive)
        .map((e: any) => ({
          key: e.name,
          maskedValue: e.maskedValue,
        }));
    }

    return Array.from(this.memoryStore.entries()).map(([key, entry]) => ({
      key,
      maskedValue: entry.maskedValue,
    }));
  }

  /**
   * Checks if a secret exists for the given key.
   *
   * @param key - The key to check.
   * @returns Whether a secret exists for this key.
   */
  async has(key: string): Promise<boolean> {
    if (this.mutationCtx) {
      const entry = await this.mutationCtx.db
        .query('vault')
        .filter((q: any) => q.eq(q.field('name'), key))
        .first();
      return entry !== null && entry !== undefined;
    }

    return this.memoryStore.has(key);
  }

  /**
   * Returns the number of stored secrets.
   */
  get size(): number {
    return this.memoryStore.size;
  }
}
