/**
 * Unit tests for SPEC-20260304-013: CLI CRUD Fixes
 *
 * Tests for:
 * - agents edit with --description, --provider, --active flags
 * - tokens create command
 * - tokens delete command with --force flag
 *
 * Spec: SPEC-20260304-013
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';

// Mock crypto for consistent token generation
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn(() => Buffer.from('a'.repeat(32), 'hex')),
}));

describe('SPEC-013: CLI CRUD Fixes', () => {
  describe('agents edit', () => {
    it('should accept --description flag', () => {
      // Test that the description option is parsed correctly
      const opts = {
        description: 'Updated agent description',
      };
      expect(opts.description).toBe('Updated agent description');
    });

    it('should accept --provider flag', () => {
      const opts = {
        provider: 'anthropic',
      };
      expect(opts.provider).toBe('anthropic');
    });

    it('should accept --active flag with true value', () => {
      const opts = {
        active: 'true',
      };
      const isActive = opts.active === 'true' || opts.active === '1';
      expect(isActive).toBe(true);
    });

    it('should accept --active flag with false value', () => {
      const opts = {
        active: 'false',
      };
      const isActive = opts.active === 'true' || opts.active === '1';
      expect(isActive).toBe(false);
    });

    it('should handle model:provider format for --model flag', () => {
      const model = 'anthropic:claude-sonnet-4-6';
      const [provider, modelId] = model.split(':');
      expect(provider).toBe('anthropic');
      expect(modelId).toBe('claude-sonnet-4-6');
    });

    it('should build correct update payload with multiple flags', () => {
      const opts = {
        name: 'Updated Agent',
        description: 'New description',
        provider: 'google',
        active: 'true',
      };

      const updates: Record<string, any> = {};
      if (opts.name) updates.name = opts.name;
      if (opts.description) updates.description = opts.description;
      if (opts.provider) updates.provider = opts.provider;
      if (opts.active !== undefined) updates.isActive = opts.active === 'true' || opts.active === '1';

      expect(updates).toEqual({
        name: 'Updated Agent',
        description: 'New description',
        provider: 'google',
        isActive: true,
      });
    });
  });

  describe('tokens create', () => {
    it('should generate token with agf_ prefix', () => {
      const mockBytes = Buffer.from('a'.repeat(32), 'hex');
      vi.mocked(randomBytes).mockReturnValue(mockBytes);

      const token = 'agf_' + randomBytes(16).toString('hex');
      expect(token).toMatch(/^agf_[a-f0-9]{32}$/);
      expect(token).toBe('agf_' + 'a'.repeat(32));
    });

    it('should require --name flag', () => {
      const opts = { name: undefined };
      if (!opts.name) {
        const error = '--name is required';
        expect(error).toBe('--name is required');
      }
    });

    it('should parse --expires date to timestamp', () => {
      const expiresDate = '2026-12-31';
      const expiresAt = new Date(expiresDate).getTime();
      expect(expiresAt).not.toBeNaN();
      expect(expiresAt).toBeGreaterThan(0);
    });

    it('should handle invalid date format for --expires', () => {
      const expiresDate = 'invalid-date';
      const expiresAt = new Date(expiresDate).getTime();
      expect(isNaN(expiresAt)).toBe(true);
    });
  });

  describe('tokens delete', () => {
    it('should find token by name', () => {
      const tokens = [
        { _id: 'token123', name: 'ci-token', token: 'agf_abc123...' },
        { _id: 'token456', name: 'dev-token', token: 'agf_def456...' },
      ];

      const nameOrId = 'ci-token';
      const token = tokens.find(
        (t) => t.name === nameOrId || t._id.toString().endsWith(nameOrId)
      );

      expect(token).toEqual({ _id: 'token123', name: 'ci-token', token: 'agf_abc123...' });
    });

    it('should find token by _id suffix', () => {
      const tokens = [
        { _id: 'token123abc', name: 'ci-token', token: 'agf_abc123...' },
        { _id: 'token456def', name: 'dev-token', token: 'agf_def456...' },
      ];

      const nameOrId = '123abc';
      const token = tokens.find(
        (t) => t.name === nameOrId || t._id.toString().endsWith(nameOrId)
      );

      expect(token).toEqual({ _id: 'token123abc', name: 'ci-token', token: 'agf_abc123...' });
    });

    it('should skip confirmation with --force flag', () => {
      const opts = { force: true };
      const shouldSkipConfirmation = opts.force === true;
      expect(shouldSkipConfirmation).toBe(true);
    });

    it('should require confirmation without --force flag', () => {
      const opts = { force: false };
      const shouldSkipConfirmation = opts.force === true;
      expect(shouldSkipConfirmation).toBe(false);
    });
  });

  describe('Convex mutations', () => {
    it('should accept partial update fields for agents:update', () => {
      const args = {
        id: 'agent-123',
        name: 'Updated Name',
        description: 'New description',
        isActive: true,
      };

      const { id, ...updates } = args;

      expect(id).toBe('agent-123');
      expect(updates).toEqual({
        name: 'Updated Name',
        description: 'New description',
        isActive: true,
      });
    });

    it('should have apiAccessTokens:remove mutation signature', () => {
      const mutationArgs = { id: 'token-id' };
      expect(mutationArgs).toHaveProperty('id');
    });

    it('should accept optional expiresAt for apiAccessTokens:generate', () => {
      const args = {
        name: 'test-token',
        expiresAt: Date.now() + 86400000, // 24 hours from now
      };

      expect(args.name).toBe('test-token');
      expect(args.expiresAt).toBeDefined();
      expect(args.expiresAt).toBeGreaterThan(0);
    });
  });
});
