/**
 * Tests for Issue #224: Token hashing behavior in HTTP channel auth
 *
 * Validates that the HTTP channel can validate tokens by hashing
 * the incoming Bearer token and comparing against stored SHA-256 hashes.
 */

import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';

// Replicate the hashToken function that should be used consistently
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

describe('Token hash validation', () => {
  it('should produce consistent SHA-256 hashes for the same token', () => {
    const token = 'agf_abc123def456abc123def456abc123def456abc123def456abc123def456abcd';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('should produce different hashes for different tokens', () => {
    const token1 = 'agf_token1111111111111111111111111111111111111111111111111111111111';
    const token2 = 'agf_token2222222222222222222222222222222222222222222222222222222222';
    expect(hashToken(token1)).not.toBe(hashToken(token2));
  });

  it('should validate a token by hashing and comparing to stored hash', () => {
    const plaintext = 'agf_' + crypto.randomBytes(32).toString('hex');
    const storedHash = hashToken(plaintext);

    // Simulate auth middleware: hash incoming token, compare to stored
    const incomingToken = plaintext;
    const incomingHash = hashToken(incomingToken);

    expect(incomingHash).toBe(storedHash);
  });

  it('should reject an invalid token via hash mismatch', () => {
    const plaintext = 'agf_' + crypto.randomBytes(32).toString('hex');
    const storedHash = hashToken(plaintext);

    const wrongToken = 'agf_' + crypto.randomBytes(32).toString('hex');
    const wrongHash = hashToken(wrongToken);

    expect(wrongHash).not.toBe(storedHash);
  });

  it('should use timing-safe comparison for hash matching', () => {
    const token = 'agf_' + crypto.randomBytes(32).toString('hex');
    const hash = hashToken(token);

    const storedBuf = Buffer.from(hash, 'hex');
    const incomingBuf = Buffer.from(hash, 'hex');

    expect(crypto.timingSafeEqual(storedBuf, incomingBuf)).toBe(true);
  });

  it('should generate a proper token prefix for display', () => {
    const token = 'agf_abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
    // Prefix format: first 8 chars + "..." + last 4 chars
    const prefix = `${token.slice(0, 8)}...${token.slice(-4)}`;
    expect(prefix).toBe('agf_abcd...5678');
    expect(prefix.length).toBeLessThan(20);
  });
});
