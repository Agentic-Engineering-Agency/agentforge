import { internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * AGE-157: Complete Project-Scoped Resources Migration
 *
 * This migration ensures all resources have a projectId assigned.
 * It handles both existing project-scoped tables and newly-added ones:
 * - sessions, messages, heartbeats, cronJobRuns, workflowSteps
 *
 * Resolution: Agent Config > Project Config > Global Config > System Defaults
 */

export const migrateProjectScoping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results: Record<string, any> = {
      defaultProjectsCreated: 0,
      tablesUpdated: {},
    };

    // Step 1: Ensure default projects exist for all users
    const allTables = [
      "agents",
      "threads",
      "files",
      "folders",
      "skills",
      "cronJobs",
      "mcpConnections",
      "channels",
      "instances",
      "usage",
      "logs",
      // New tables with projectId
      "sessions",
      "messages",
      "heartbeats",
      "cronJobRuns",
      "workflowSteps",
    ] as const;

    // Collect all unique userIds
    const userIds = new Set<string>();
    for (const table of allTables) {
      const rows = await ctx.db.query(table as any).collect();
      for (const row of rows) {
        if ((row as any).userId) {
          userIds.add((row as any).userId as string);
        }
      }
    }

    // Ensure system default project exists
    const systemKey = "__system_default__";
    let systemDefaultProjectId: Id<"projects"> | undefined;

    const existingSystem = await ctx.db
      .query("projects")
      .withIndex("byUserId", (q) => q.eq("userId", systemKey))
      .filter((q) => q.eq(q.field("isDefault"), true))
      .first();

    if (existingSystem) {
      systemDefaultProjectId = existingSystem._id;
    } else {
      systemDefaultProjectId = await ctx.db.insert("projects", {
        name: "System Default",
        description: "Auto-created system default project for resources with no userId",
        userId: systemKey,
        isDefault: true,
        settings: {},
        createdAt: now,
        updatedAt: now,
      });
      results.defaultProjectsCreated++;
    }

    // Build userId -> default projectId mapping
    const userIdToProjectId = new Map<string, Id<"projects">>();
    userIdToProjectId.set(systemKey, systemDefaultProjectId);

    for (const userId of userIds) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("byUserId", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isDefault"), true))
        .first();

      if (existing) {
        userIdToProjectId.set(userId, existing._id);
      } else {
        const projectId = await ctx.db.insert("projects", {
          name: "Default",
          description: "Auto-created default project",
          userId,
          isDefault: true,
          settings: {},
          createdAt: now,
          updatedAt: now,
        });
        userIdToProjectId.set(userId, projectId);
        results.defaultProjectsCreated++;
      }
    }

    // Helper to resolve projectId
    const resolveProjectId = (userId: string | undefined): Id<"projects"> => {
      if (!userId) return systemDefaultProjectId!;
      return userIdToProjectId.get(userId) ?? systemDefaultProjectId!;
    };

    // Step 2: Backfill projectId for all tables
    for (const table of allTables) {
      let count = 0;
      const rows = await ctx.db.query(table as any).collect();

      for (const row of rows) {
        const typed = row as any;
        // Skip if already has projectId
        if (typed.projectId !== undefined) continue;

        const projectId = resolveProjectId(typed.userId);
        await ctx.db.patch(typed._id, { projectId });
        count++;
      }

      results.tablesUpdated[table] = count;
    }

    return results;
  },
});

/**
 * Validate that all resources have projectId assigned.
 * Returns counts of resources without projectId (should be zero after migration).
 */
export const validateProjectScoping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allTables = [
      "agents",
      "threads",
      "files",
      "folders",
      "skills",
      "cronJobs",
      "mcpConnections",
      "channels",
      "instances",
      "usage",
      "logs",
      "sessions",
      "messages",
      "heartbeats",
      "cronJobRuns",
      "workflowSteps",
    ] as const;

    const missing: Record<string, number> = {};

    for (const table of allTables) {
      const rows = await ctx.db.query(table as any).collect();
      const count = rows.filter((row) => (row as any).projectId === undefined).length;
      if (count > 0) {
        missing[table] = count;
      }
    }

    return {
      valid: Object.keys(missing).length === 0,
      missing,
    };
  },
});
