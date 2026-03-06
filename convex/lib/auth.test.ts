import { describe, expect, test, vi } from "vitest";
import {
  requireAuth,
  requireToken,
  requireTokenOrAuth,
} from "./auth";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";

// Mock contexts
function createMockContext(overrides = {}): Partial<MutationCtx | QueryCtx> {
  return {
    auth: {
      getUserIdentity: () => overrides.auth?.getUserIdentity?.() || null,
    },
    db: {
      query: () => ({
        withIndex: () => ({
          first: () => overrides.db?.query?.()?.withIndex?.()?.first?.() || null,
        }),
      }),
    },
  };
}

describe("convex/lib/auth", () => {
  describe("requireAuth", () => {
    test("throws when no identity present", () => {
      const ctx = createMockContext() as MutationCtx;

      expect(() => requireAuth(ctx)).toThrow(ConvexError);
      expect(() => requireAuth(ctx)).toThrow("Unauthorized");
    });

    test("does not throw when identity is present", () => {
      const ctx = createMockContext({
        auth: {
          getUserIdentity: () => ({ tokenIdentifier: "test-token" }),
        },
      }) as MutationCtx;

      expect(() => requireAuth(ctx)).not.toThrow();
    });

    test("returns identity when present", () => {
      const identity = { tokenIdentifier: "test-token" };
      const ctx = createMockContext({
        auth: {
          getUserIdentity: () => identity,
        },
      }) as MutationCtx;

      const result = requireAuth(ctx);
      expect(result).toEqual(identity);
      expect(result.tokenIdentifier).toBe("test-token");
    });
  });

  describe("requireToken", () => {
    test("throws when token not found", async () => {
      const ctx = createMockContext({
        db: {
          query: () => ({
            withIndex: () => ({
              first: async () => null,
            }),
          }),
        },
      }) as MutationCtx;

      await expect(requireToken(ctx, "invalid-token")).rejects.toThrow(
        ConvexError
      );
      await expect(requireToken(ctx, "invalid-token")).rejects.toThrow(
        "Invalid token"
      );
    });

    test("throws when token is inactive", async () => {
      const ctx = createMockContext({
        db: {
          query: () => ({
            withIndex: () => ({
              first: async () => ({
                _id: "id123",
                token: "test-token",
                name: "Test Token",
                isActive: false,
                createdAt: Date.now(),
              }),
            }),
          }),
        },
      }) as MutationCtx;

      await expect(requireToken(ctx, "inactive-token")).rejects.toThrow(
        ConvexError
      );
      await expect(requireToken(ctx, "inactive-token")).rejects.toThrow(
        "Invalid token"
      );
    });

    test("does not throw when token is active", async () => {
      const ctx = createMockContext({
        db: {
          query: () => ({
            withIndex: () => ({
              first: async () => ({
                _id: "id123",
                token: "test-token",
                name: "Test Token",
                isActive: true,
                createdAt: Date.now(),
              }),
            }),
          }),
        },
      }) as MutationCtx;

      await expect(requireToken(ctx, "active-token")).resolves.not.toThrow();
    });

    test("returns token document when active", async () => {
      const tokenDoc = {
        _id: "id123",
        token: "test-token",
        name: "Test Token",
        isActive: true,
        createdAt: Date.now(),
      };
      const ctx = createMockContext({
        db: {
          query: () => ({
            withIndex: () => ({
              first: async () => tokenDoc,
            }),
          }),
        },
      }) as MutationCtx;

      const result = await requireToken(ctx, "active-token");
      expect(result).toEqual(tokenDoc);
    });
  });

  describe("requireTokenOrAuth", () => {
    test("uses auth when identity present", async () => {
      const identity = { tokenIdentifier: "test-token" };
      const ctx = createMockContext({
        auth: {
          getUserIdentity: () => identity,
        },
      }) as MutationCtx;

      const result = await requireTokenOrAuth(ctx, undefined);
      expect(result).toEqual({ type: "auth", identity });
    });

    test("uses token when auth not present but token provided", async () => {
      const tokenDoc = {
        _id: "id123",
        token: "test-token",
        name: "Test Token",
        isActive: true,
        createdAt: Date.now(),
      };
      const ctx = createMockContext({
        db: {
          query: () => ({
            withIndex: () => ({
              first: async () => tokenDoc,
            }),
          }),
        },
      }) as MutationCtx;

      const result = await requireTokenOrAuth(ctx, "test-token");
      expect(result).toEqual({ type: "token", token: tokenDoc });
    });

    test("throws when neither auth nor token provided", async () => {
      const ctx = createMockContext() as MutationCtx;

      await expect(requireTokenOrAuth(ctx, undefined)).rejects.toThrow(
        ConvexError
      );
      await expect(requireTokenOrAuth(ctx, undefined)).rejects.toThrow(
        "Unauthorized"
      );
    });
  });
});
