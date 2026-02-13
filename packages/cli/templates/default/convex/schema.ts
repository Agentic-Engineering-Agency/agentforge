import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    id: v.string(),
    name: v.string(),
    instructions: v.string(),
    model: v.string(),
    tools: v.optional(v.any()),
  }).index("by_id", ["id"]),

  threads: defineTable({
    name: v.optional(v.string()),
  }),

  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    tool_calls: v.optional(v.any()),
  }).index("by_thread", ["threadId"]),
});
