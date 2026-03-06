import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Authentication and authorization utilities for Convex functions.
 *
 * Provides token-based authentication for API access and identity-based
 * authentication for dashboard users.
 */

/**
 * Identity type returned by Convex auth
 */
export type AuthIdentity = {
  tokenIdentifier: string;
  issuer?: string;
  subject?: string;
};

/**
 * Token document from apiAccessTokens table
 */
export type TokenDoc = {
  _id: Id<"apiAccessTokens">;
  token: string;
  name: string;
  createdAt: number;
  expiresAt?: number;
  isActive: boolean;
};

/**
 * Auth result - either identity or token
 */
export type AuthResult =
  | { type: "auth"; identity: AuthIdentity }
  | { type: "token"; token: TokenDoc };

/**
 * Require authenticated user identity.
 *
 * Use this for Convex functions that require dashboard user authentication.
 * Throws ConvexError if no identity is present.
 *
 * @param ctx - MutationCtx or QueryCtx
 * @returns The authenticated user identity
 * @throws ConvexError with "Unauthorized" if no identity
 */
export function requireAuth(
  ctx: MutationCtx | QueryCtx
): AuthIdentity {
  const identity = ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized");
  }
  return identity as AuthIdentity;
}

/**
 * Require valid API token.
 *
 * Use this for Convex functions that support API token authentication.
 * Validates token exists and is active.
 *
 * @param ctx - MutationCtx or QueryCtx
 * @param token - API token string to validate
 * @returns The token document if valid
 * @throws ConvexError with "Invalid token" if token not found or inactive
 */
export async function requireToken(
  ctx: MutationCtx | QueryCtx,
  token: string
): Promise<TokenDoc> {
  const tokenDoc = await ctx.db
    .query("apiAccessTokens")
    .withIndex("byToken", (q) => q.eq("token", token))
    .first();

  if (!tokenDoc || !tokenDoc.isActive) {
    throw new ConvexError("Invalid token");
  }

  if (tokenDoc.expiresAt && tokenDoc.expiresAt < Date.now()) {
    throw new ConvexError("Invalid token");
  }

  return tokenDoc as TokenDoc;
}

/**
 * Require authentication in an action context.
 *
 * Actions cannot use ctx.db directly, so token validation must be done
 * via a provided async validator function (typically ctx.runQuery).
 * Prioritizes identity auth; falls back to token validation.
 *
 * @param identity - User identity from ctx.auth.getUserIdentity()
 * @param token - Optional API token string
 * @param validateToken - Async function that resolves a token to its record or null
 * @throws ConvexError with "Unauthorized" if neither auth method succeeds
 * @throws ConvexError with "Invalid token" if token is invalid/expired
 */
export async function requireActionAuth(
  identity: { tokenIdentifier: string } | null,
  token: string | undefined,
  validateToken: (t: string) => Promise<unknown>
): Promise<void> {
  if (identity) return;
  if (!token) throw new ConvexError("Unauthorized");
  const tokenDoc = await validateToken(token);
  if (!tokenDoc) throw new ConvexError("Invalid token");
}

/**
 * Require either authenticated identity OR valid API token.
 *
 * Use this for Convex functions that support both dashboard auth and API tokens.
 * Prioritizes identity if present, otherwise validates token.
 *
 * @param ctx - MutationCtx or QueryCtx
 * @param token - Optional API token string to validate if no identity
 * @returns AuthResult indicating which auth method succeeded
 * @throws ConvexError with "Unauthorized" if neither auth method succeeds
 */
export async function requireTokenOrAuth(
  ctx: MutationCtx | QueryCtx,
  token: string | undefined
): Promise<AuthResult> {
  // Try identity auth first
  const identity = ctx.auth.getUserIdentity();
  if (identity) {
    return { type: "auth", identity: identity as AuthIdentity };
  }

  // Fall back to token auth if token provided
  if (token) {
    const tokenDoc = await requireToken(ctx, token);
    return { type: "token", token: tokenDoc };
  }

  // Neither auth method succeeded
  throw new ConvexError("Unauthorized");
}
