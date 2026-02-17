import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConvexVault, maskValue } from './convex-vault.js';

describe('ConvexVault', () => {
  const testKey = 'test-encryption-key-32chars-long!';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Construction ---

  describe('constructor', () => {
    it('should create a vault with a custom encryption key', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      expect(vault).toBeDefined();
    });

    it('should create a vault with default key', () => {
      const vault = new ConvexVault();
      expect(vault).toBeDefined();
    });

    it('should create a vault from env var', () => {
      const original = process.env.VAULT_ENCRYPTION_KEY;
      process.env.VAULT_ENCRYPTION_KEY = 'env-key-test';
      const vault = new ConvexVault();
      expect(vault).toBeDefined();
      if (original !== undefined) {
        process.env.VAULT_ENCRYPTION_KEY = original;
      } else {
        delete process.env.VAULT_ENCRYPTION_KEY;
      }
    });
  });

  // --- Encryption / Decryption ---

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a value correctly', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const original = 'sk-test-api-key-12345';

      const encrypted = vault.encrypt(original);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.ciphertext).not.toBe(original);

      const decrypted = vault.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
      );
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertexts for the same plaintext', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const value = 'same-value';

      const enc1 = vault.encrypt(value);
      const enc2 = vault.encrypt(value);

      // Different IVs should produce different ciphertexts
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);

      // But both should decrypt to the same value
      expect(vault.decrypt(enc1.ciphertext, enc1.iv, enc1.authTag)).toBe(value);
      expect(vault.decrypt(enc2.ciphertext, enc2.iv, enc2.authTag)).toBe(value);
    });

    it('should handle empty strings', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const encrypted = vault.encrypt('');
      const decrypted = vault.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
      );
      expect(decrypted).toBe('');
    });

    it('should handle long strings', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const longValue = 'a'.repeat(10000);
      const encrypted = vault.encrypt(longValue);
      const decrypted = vault.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
      );
      expect(decrypted).toBe(longValue);
    });

    it('should handle unicode strings', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const unicodeValue = '你好世界🌍 مرحبا';
      const encrypted = vault.encrypt(unicodeValue);
      const decrypted = vault.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
      );
      expect(decrypted).toBe(unicodeValue);
    });

    it('should fail to decrypt with wrong key', () => {
      const vault1 = new ConvexVault({ encryptionKey: 'key-one' });
      const vault2 = new ConvexVault({ encryptionKey: 'key-two' });

      const encrypted = vault1.encrypt('secret');
      expect(() =>
        vault2.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag),
      ).toThrow();
    });

    it('should fail to decrypt with tampered ciphertext', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const encrypted = vault.encrypt('secret-data-to-tamper');

      // Completely reverse the ciphertext to guarantee mismatch
      const tampered = encrypted.ciphertext
        .split('')
        .map((c) => {
          const n = parseInt(c, 16);
          return isNaN(n) ? c : ((n + 8) % 16).toString(16);
        })
        .join('');
      expect(() =>
        vault.decrypt(tampered, encrypted.iv, encrypted.authTag),
      ).toThrow();
    });

    it('should fail to decrypt with tampered auth tag', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const encrypted = vault.encrypt('secret');

      const tamperedTag = 'ff'.repeat(16);
      expect(() =>
        vault.decrypt(encrypted.ciphertext, encrypted.iv, tamperedTag),
      ).toThrow();
    });
  });

  // --- maskValue ---

  describe('maskValue', () => {
    it('should mask short values (<=8 chars)', () => {
      expect(maskValue('abcdef')).toBe('ab...ef');
    });

    it('should mask medium values (9-12 chars)', () => {
      expect(maskValue('abcdefghij')).toBe('abc...hij');
    });

    it('should mask long values (>12 chars)', () => {
      expect(maskValue('sk-1234567890abcdef')).toBe('sk-123...cdef');
    });

    it('should handle very short values', () => {
      expect(maskValue('abc')).toBe('ab...bc');
    });
  });

  // --- set / get (in-memory mode) ---

  describe('set/get (in-memory)', () => {
    it('should store and retrieve a secret', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await vault.set('api-key', 'sk-secret-value');
      const result = await vault.get('api-key');
      expect(result).toBe('sk-secret-value');
    });

    it('should return null for missing keys', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const result = await vault.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should overwrite existing values', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await vault.set('key', 'value1');
      await vault.set('key', 'value2');
      const result = await vault.get('key');
      expect(result).toBe('value2');
    });

    it('should handle multiple different keys', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await vault.set('key1', 'value1');
      await vault.set('key2', 'value2');
      await vault.set('key3', 'value3');

      expect(await vault.get('key1')).toBe('value1');
      expect(await vault.get('key2')).toBe('value2');
      expect(await vault.get('key3')).toBe('value3');
    });

    it('should throw for empty key in set', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await expect(vault.set('', 'value')).rejects.toThrow(
        'Vault key must be a non-empty string.',
      );
    });

    it('should throw for null value in set', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await expect(vault.set('key', null as any)).rejects.toThrow(
        'Vault value must not be null or undefined.',
      );
    });

    it('should throw for undefined value in set', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await expect(vault.set('key', undefined as any)).rejects.toThrow(
        'Vault value must not be null or undefined.',
      );
    });

    it('should throw for empty key in get', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await expect(vault.get('')).rejects.toThrow(
        'Vault key must be a non-empty string.',
      );
    });
  });

  // --- delete ---

  describe('delete (in-memory)', () => {
    it('should delete an existing key', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await vault.set('to-delete', 'value');
      const deleted = await vault.delete('to-delete');
      expect(deleted).toBe(true);
      expect(await vault.get('to-delete')).toBeNull();
    });

    it('should return false for non-existing key', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const deleted = await vault.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should throw for empty key', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await expect(vault.delete('')).rejects.toThrow(
        'Vault key must be a non-empty string.',
      );
    });
  });

  // --- list ---

  describe('list (in-memory)', () => {
    it('should return empty array when no secrets stored', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const list = await vault.list();
      expect(list).toEqual([]);
    });

    it('should return all stored secrets with masked values', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await vault.set('key1', 'sk-1234567890abcdef');
      await vault.set('key2', 'ghp_abcdefghijklmnop1234567890123456');

      const list = await vault.list();
      expect(list).toHaveLength(2);
      expect(list.map((e) => e.key).sort()).toEqual(['key1', 'key2']);
      // Masked values should not contain the full secret
      expect(list[0].maskedValue).toContain('...');
      expect(list[1].maskedValue).toContain('...');
    });
  });

  // --- has ---

  describe('has (in-memory)', () => {
    it('should return false for non-existing key', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      expect(await vault.has('nope')).toBe(false);
    });

    it('should return true for existing key', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await vault.set('exists', 'value');
      expect(await vault.has('exists')).toBe(true);
    });
  });

  // --- size ---

  describe('size', () => {
    it('should return 0 initially', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      expect(vault.size).toBe(0);
    });

    it('should track stored items', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      await vault.set('a', '1');
      await vault.set('b', '2');
      expect(vault.size).toBe(2);
    });
  });

  // --- setContext (Convex-backed mode) ---

  describe('setContext', () => {
    function createMockMutationCtx() {
      const store = new Map<string, any>();
      let idCounter = 0;

      return {
        db: {
          insert: vi.fn(async (table: string, doc: any) => {
            const id = `id_${++idCounter}`;
            store.set(id, { ...doc, _id: id });
            return id;
          }),
          get: vi.fn(async (id: any) => store.get(id) || null),
          patch: vi.fn(async (id: any, fields: any) => {
            const existing = store.get(id);
            if (existing) {
              store.set(id, { ...existing, ...fields });
            }
          }),
          delete: vi.fn(async (id: any) => {
            store.delete(id);
          }),
          query: vi.fn((table: string) => ({
            filter: vi.fn(() => ({
              first: vi.fn(async () => {
                // Search by name
                for (const [, doc] of store) {
                  return doc;
                }
                return null;
              }),
            })),
            collect: vi.fn(async () => Array.from(store.values())),
          })),
        },
      };
    }

    it('should set the mutation context', () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const mockMutCtx = createMockMutationCtx();
      vault.setContext(mockMutCtx as any);
      expect(vault).toBeDefined();
    });

    it('should use Convex db for set when context is available', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const mockMutCtx = createMockMutationCtx();
      vault.setContext(mockMutCtx as any);

      await vault.set('test-key', 'test-value');

      expect(mockMutCtx.db.query).toHaveBeenCalledWith('vault');
    });

    it('should use Convex db for get when context is available', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const mockMutCtx = createMockMutationCtx();
      vault.setContext(mockMutCtx as any);

      // Set first to have data
      await vault.set('test-key', 'test-value');

      const result = await vault.get('test-key');
      // Result depends on mock implementation
      expect(mockMutCtx.db.query).toHaveBeenCalledWith('vault');
    });

    it('should use Convex db for delete when context is available', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const mockMutCtx = createMockMutationCtx();
      vault.setContext(mockMutCtx as any);

      await vault.set('to-delete', 'value');
      await vault.delete('to-delete');

      expect(mockMutCtx.db.query).toHaveBeenCalledWith('vault');
    });

    it('should use Convex db for list when context is available', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const mockMutCtx = createMockMutationCtx();
      vault.setContext(mockMutCtx as any);

      const list = await vault.list();
      expect(mockMutCtx.db.query).toHaveBeenCalledWith('vault');
    });

    it('should use Convex db for has when context is available', async () => {
      const vault = new ConvexVault({ encryptionKey: testKey });
      const mockMutCtx = createMockMutationCtx();
      vault.setContext(mockMutCtx as any);

      await vault.has('some-key');
      expect(mockMutCtx.db.query).toHaveBeenCalledWith('vault');
    });
  });
});
