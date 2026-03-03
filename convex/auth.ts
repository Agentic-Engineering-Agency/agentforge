/**
 * Dashboard Authentication
 *
 * Simple password-based auth for dashboard protection.
 * Uses settings table for password storage.
 *
 * This is a lightweight auth solution for local/self-hosted deployments.
 * For production multi-tenant scenarios, integrate Better Auth or similar.
 */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// =====================================================
// Types & Constants
// =====================================================

const DASHBOARD_USER_ID = 'dashboard';
const PASSWORD_KEY = 'password';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * In-memory session store for single-instance deployment.
 *
 * SECURITY NOTE: This approach has limitations:
 * - Sessions are not shared across multiple server instances
 * - Server restarts will clear active sessions (though DB persists them)
 * - For production multi-instance deployments, use:
 *   - Convex database storage (already implemented as fallback)
 *   - Redis or similar distributed cache
 *
 * The current implementation uses a hybrid approach: in-memory cache
 * for fast validation, with automatic fallback to Convex database storage.
 */
const sessionStore = new Map<string, { createdAt: number; expiresAt: number }>();

// =====================================================
// Password Management
// =====================================================

/**
 * Simple hash function for password storage.
 * Note: For production, use bcrypt or argon2.
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'agentforge-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Set the dashboard password.
 * Stores a hash in the settings table.
 */
export const setPassword = mutation({
  args: {
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const hashedPassword = await hashPassword(args.password);

    // Check if setting already exists
    const existing = await ctx.db
      .query('settings')
      .withIndex('byUserIdAndKey', (q) =>
        q.eq('userId', DASHBOARD_USER_ID).eq('key', PASSWORD_KEY)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: hashedPassword,
        updatedAt: Date.now(),
      });
      return {
        success: true,
        userId: DASHBOARD_USER_ID,
        key: PASSWORD_KEY,
        updated: true,
      };
    }

    await ctx.db.insert('settings', {
      userId: DASHBOARD_USER_ID,
      key: PASSWORD_KEY,
      value: hashedPassword,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      userId: DASHBOARD_USER_ID,
      key: PASSWORD_KEY,
      updated: false,
    };
  },
});

/**
 * Validate a password against the stored hash.
 */
export const validatePassword = query({
  args: {
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query('settings')
      .withIndex('byUserIdAndKey', (q) =>
        q.eq('userId', DASHBOARD_USER_ID).eq('key', PASSWORD_KEY)
      )
      .first();

    if (!setting) {
      return { valid: false };
    }

    const hashedPassword = await hashPassword(args.password);
    const isValid = hashedPassword === setting.value;

    return { valid: isValid };
  },
});

// =====================================================
// API Keys
// =====================================================

/**
 * Generate a random API key for dashboard access.
 */
export const generateApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const apiKey = `ag_${crypto.randomUUID().replace(/-/g, '')}`;

    // Store in settings
    const existing = await ctx.db
      .query('settings')
      .withIndex('byUserIdAndKey', (q) =>
        q.eq('userId', DASHBOARD_USER_ID).eq('key', 'apiKey')
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: apiKey,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('settings', {
        userId: DASHBOARD_USER_ID,
        key: 'apiKey',
        value: apiKey,
        updatedAt: Date.now(),
      });
    }

    return { apiKey };
  },
});

/**
 * Validate an API key.
 */
export const validateApiKey = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query('settings')
      .withIndex('byUserIdAndKey', (q) =>
        q.eq('userId', DASHBOARD_USER_ID).eq('key', 'apiKey')
      )
      .first();

    if (!setting) {
      return { valid: false };
    }

    return { valid: setting.value === args.apiKey };
  },
});

// =====================================================
// Sessions
// =====================================================

/**
 * Create a session token for dashboard access.
 */
export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    const token = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    const now = Date.now();
    const expiresAt = now + SESSION_EXPIRY_MS;

    // Store in-memory for quick validation
    sessionStore.set(token, { createdAt: now, expiresAt });

    // Also persist to settings for recovery
    const sessionsKey = `session_${token}`;
    await ctx.db.insert('settings', {
      userId: DASHBOARD_USER_ID,
      key: sessionsKey,
      value: { createdAt: now, expiresAt },
      updatedAt: now,
    });

    return {
      token,
      expiresAt,
    };
  },
});

/**
 * Validate a session token.
 */
export const getSession = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check in-memory store first
    const session = sessionStore.get(args.token);
    if (session) {
      if (now > session.expiresAt) {
        sessionStore.delete(args.token);
        return { valid: false, error: 'expired' };
      }
      return {
        valid: true,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      };
    }

    // Fallback to database
    const setting = await ctx.db
      .query('settings')
      .withIndex('byUserIdAndKey', (q) =>
        q.eq('userId', DASHBOARD_USER_ID).eq('key', `session_${args.token}`)
      )
      .first();

    if (!setting) {
      return { valid: false, error: 'not_found' };
    }

    const sessionData = setting.value as { createdAt: number; expiresAt: number };
    if (now > sessionData.expiresAt) {
      // Clean up expired session
      await ctx.db.delete(setting._id);
      return { valid: false, error: 'expired' };
    }

    // Restore to memory cache
    sessionStore.set(args.token, sessionData);

    return {
      valid: true,
      createdAt: sessionData.createdAt,
      expiresAt: sessionData.expiresAt,
    };
  },
});

/**
 * Clean up expired sessions (maintenance task).
 */
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sessions = await ctx.db
      .query('settings')
      .withIndex('byUserId', (q) => q.eq('userId', DASHBOARD_USER_ID))
      .collect();

    let cleanedCount = 0;
    for (const session of sessions) {
      if (session.key.startsWith('session_')) {
        const sessionData = session.value as { createdAt: number; expiresAt: number };
        if (now > sessionData.expiresAt) {
          await ctx.db.delete(session._id);
          sessionStore.delete(session.key.replace('session_', ''));
          cleanedCount++;
        }
      }
    }

    return { cleanedCount };
  },
});
