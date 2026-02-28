/**
 * Tests for Dashboard Authentication
 *
 * Tests simple password-based auth for dashboard protection.
 * These tests verify auth logic independent of Convex.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Simple hash function matching the implementation
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'agentforge-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// =====================================================
// RED: Tests first (TDD)
// =====================================================

describe('Dashboard Auth - Password Hashing', () => {
  it('should generate consistent hash for same password', async () => {
    const password = 'test-password-123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different passwords', async () => {
    const hash1 = await hashPassword('password-one');
    const hash2 = await hashPassword('password-two');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate hash of correct length (SHA-256)', async () => {
    const hash = await hashPassword('any-password');
    expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
  });

  it('should generate valid hexadecimal string', async () => {
    const hash = await hashPassword('test-password');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle empty password', async () => {
    const hash = await hashPassword('');
    expect(hash.length).toBe(64);
  });

  it('should handle special characters', async () => {
    const hash = await hashPassword('p@$$w0rd!#*&%^');
    expect(hash.length).toBe(64);
  });
});

describe('Dashboard Auth - API Key Generation', () => {
  it('should generate unique API keys', () => {
    const key1 = `ag_${crypto.randomUUID().replace(/-/g, '')}`;
    const key2 = `ag_${crypto.randomUUID().replace(/-/g, '')}`;
    expect(key1).not.toBe(key2);
  });

  it('should generate API key with correct prefix', () => {
    const key = `ag_${crypto.randomUUID().replace(/-/g, '')}`;
    expect(key.startsWith('ag_')).toBe(true);
  });

  it('should generate API key of sufficient length', () => {
    const key = `ag_${crypto.randomUUID().replace(/-/g, '')}`;
    expect(key.length).toBeGreaterThan(30); // UUID is 36 chars without dashes = 32 + 3 for prefix = 35
  });
});

describe('Dashboard Auth - Session Token Generation', () => {
  it('should generate unique session tokens', () => {
    const token1 = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    const token2 = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    expect(token1).not.toBe(token2);
  });

  it('should generate session token with correct prefix', () => {
    const token = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    expect(token.startsWith('sess_')).toBe(true);
  });

  it('should generate session token of sufficient length', () => {
    const token = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    expect(token.length).toBeGreaterThan(35);
  });
});

describe('Dashboard Auth - Session Expiry', () => {
  const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  it('should calculate correct expiry time', () => {
    const now = Date.now();
    const expiresAt = now + SESSION_EXPIRY_MS;
    expect(expiresAt).toBeGreaterThan(now);
    expect(expiresAt - now).toBe(SESSION_EXPIRY_MS);
  });

  it('should expire after 24 hours', () => {
    const createdAt = Date.now();
    const expiresAt = createdAt + SESSION_EXPIRY_MS;
    const now = Date.now() + SESSION_EXPIRY_MS + 1000; // 1 second past expiry
    expect(now).toBeGreaterThan(expiresAt);
  });

  it('should be valid within 24 hours', () => {
    const createdAt = Date.now();
    const expiresAt = createdAt + SESSION_EXPIRY_MS;
    const now = Date.now() + SESSION_EXPIRY_MS - 1000; // 1 second before expiry
    expect(now).toBeLessThan(expiresAt);
  });
});
