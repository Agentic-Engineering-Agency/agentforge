import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  resolveConfig,
  type AgentConfig,
  type ProjectSettings,
  type GlobalSettings,
} from "./lib/configCascade";

/**
 * Get resolved configuration for an agent.
 *
 * Resolution cascade: Agent Config > Project Config > Global Config > System Defaults
 *
 * @param agentId - The agent's string ID
 * @param projectId - Optional project ID for project-level config
 * @param userId - Optional user ID for global user settings
 * @returns Resolved configuration with all defaults applied
 */
export const getConfig = query({
  args: {
    agentId: v.string(),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fetch agent
    const agent = await ctx.db
      .query("agents")
      .withIndex("byAgentId", (q) => q.eq("id", args.agentId))
      .first();

    if (!agent) {
      throw new Error(`Agent with id ${args.agentId} not found`);
    }

    // Fetch project settings if projectId provided
    let projectSettings: ProjectSettings | null = null;
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (project?.settings) {
        projectSettings = project.settings as ProjectSettings;
      }
    }

    // Fetch global settings if userId provided
    let globalSettings: GlobalSettings | null = null;
    if (args.userId) {
      // Look for a global config setting
      const globalSetting = await ctx.db
        .query("settings")
        .withIndex("byUserIdAndKey", (q) =>
          q.eq("userId", args.userId ?? "").eq("key", "globalConfig")
        )
        .first();

      if (globalSetting?.value) {
        globalSettings = globalSetting.value as GlobalSettings;
      }
    }

    // Build agent config from database agent
    // Map failoverModels from { provider, model }[] to string[]
    const agentConfig: AgentConfig = {
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      instructions: agent.instructions,
      failoverModels: agent.failoverModels?.map((f: any) =>
        typeof f === "string" ? f : `${f.provider}/${f.model}`
      ),
    };

    // Resolve configuration using the cascade
    return resolveConfig(agentConfig, projectSettings, globalSettings);
  },
});
