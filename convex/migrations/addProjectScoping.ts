import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Step 1: Create a "Default" project for each unique userId found across all
 * project-scoped tables. Also creates a __system_default__ project for rows
 * with no userId. Returns a mapping of userId -> projectId.
 *
 * Idempotent: skips users that already have a default project.
 */
export const createDefaultProjects = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userIdToProjectId = new Map<string, Id<"projects">>();
    const now = Date.now();

    // Collect all distinct userIds from project-scoped tables
    const tables = [
      "agents",
      "skills",
      "cronJobs",
      "mcpConnections",
      "usage",
      "logs",
      "channels",
      "instances",
      "threads",
      "files",
      "folders",
    ] as const;

    const userIds = new Set<string>();
    for (const table of tables) {
      const rows = await ctx.db.query(table as any).collect();
      for (const row of rows) {
        if ((row as any).userId) {
          userIds.add((row as any).userId as string);
        }
      }
    }

    // Ensure a system default project exists for rows with no userId
    const systemKey = "__system_default__";
    const existingSystem = await ctx.db
      .query("projects")
      .withIndex("byUserId", (q) => q.eq("userId", systemKey))
      .filter((q) => q.eq(q.field("isDefault"), true))
      .first();

    if (existingSystem) {
      userIdToProjectId.set(systemKey, existingSystem._id);
    } else {
      const systemProjectId = await ctx.db.insert("projects", {
        name: "System Default",
        description: "Auto-created system default project for rows with no userId",
        userId: systemKey,
        isDefault: true,
        settings: {},
        createdAt: now,
        updatedAt: now,
      });
      userIdToProjectId.set(systemKey, systemProjectId);
    }

    // For each userId, create a Default project if one doesn't exist
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
      }
    }

    // Return mapping as a plain object for logging / chaining
    const result: Record<string, string> = {};
    for (const [userId, projectId] of userIdToProjectId) {
      result[userId] = projectId;
    }
    return result;
  },
});

/**
 * Step 2: Backfill projectId on all project-scoped tables.
 *
 * For each row where projectId is undefined, resolves the correct default
 * project via userId (or the system default for rows with no userId) and
 * patches the row.
 *
 * Idempotent: only updates rows where projectId is currently undefined.
 * Returns counts of updated rows per table.
 */
export const backfillProjectIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};

    // Build userId -> default projectId lookup
    const defaultProjects = await ctx.db
      .query("projects")
      .collect();

    const userIdToProjectId = new Map<string, Id<"projects">>();
    for (const project of defaultProjects) {
      if (project.isDefault && project.userId) {
        userIdToProjectId.set(project.userId, project._id);
      }
    }

    const systemDefault = userIdToProjectId.get("__system_default__");

    const resolveProjectId = (userId: string | undefined): Id<"projects"> | undefined => {
      if (!userId) return systemDefault;
      return userIdToProjectId.get(userId) ?? systemDefault;
    };

    // Tables to backfill
    const tables = [
      "agents",
      "skills",
      "cronJobs",
      "mcpConnections",
      "usage",
      "logs",
      "channels",
      "instances",
      "threads",
      "files",
      "folders",
    ] as const;

    for (const table of tables) {
      let count = 0;
      const rows = await ctx.db.query(table as any).collect();
      for (const row of rows) {
        const typed = row as any;
        if (typed.projectId !== undefined) continue; // already backfilled
        const projectId = resolveProjectId(typed.userId);
        if (projectId) {
          await ctx.db.patch(typed._id, { projectId });
          count++;
        }
      }
      counts[table] = count;
    }

    return counts;
  },
});
