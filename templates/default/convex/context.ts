/**
 * Context Window Management (AGE-158 + AGE-177)
 *
 * Provides context management strategies for agent conversations:
 * - sliding: drop oldest messages when over token limit
 * - truncate: drop oldest messages when over token limit (same as sliding)
 * - summarize: compress oldest messages using a cheap model
 *
 * AGE-158: Context window management
 * AGE-177: Configurable context strategies per agent
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Agent } from "./lib/agent";

type MessageListInput = Array<{ role: "user" | "assistant" | "system"; content: string }>;

// ─── Pure context management functions (inlined for portability) ───────────────

/** Default token limit for context window */
export const DEFAULT_TOKEN_LIMIT = 8000;

/** Supported context strategies */
export type ContextStrategy = "sliding" | "truncate" | "summarize";

/** Message shape compatible with Mastra and Convex */
export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

/** Count approximate tokens in text (4 chars ≈ 1 token). */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Count tokens across an array of messages. */
export function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + countTokens(m.content), 0);
}

/**
 * Apply sliding window: drop oldest messages when over limit.
 * Always keeps the most recent message.
 */
export function applySliding(messages: Message[], limit = DEFAULT_TOKEN_LIMIT): Message[] {
  if (messages.length === 0 || limit <= 0) return [];

  const result: Message[] = [];
  let currentTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = countTokens(msg.content);

    if (currentTokens + msgTokens <= limit) {
      result.unshift(msg);
      currentTokens += msgTokens;
    }

    if (i === messages.length - 1 && !result.includes(msg)) {
      const maxContentChars = limit * 4;
      if (maxContentChars > 0) {
        result.unshift({ role: msg.role, content: msg.content.slice(0, maxContentChars) });
      }
      break;
    }
  }

  return result;
}

/** Apply truncate strategy (identical to sliding for now). */
export function applyTruncate(messages: Message[], limit = DEFAULT_TOKEN_LIMIT): Message[] {
  return applySliding(messages, limit);
}

/** Returns true when messages exceed 80% of the token limit. */
export function shouldSummarize(messages: Message[], limit = DEFAULT_TOKEN_LIMIT): boolean {
  return countMessagesTokens(messages) > limit * 0.8;
}

/** Apply the configured context strategy to a message list. */
export function applyContextStrategy(
  messages: Message[],
  strategy: ContextStrategy = "sliding",
  limit = DEFAULT_TOKEN_LIMIT
): Message[] {
  switch (strategy) {
    case "truncate":
      return applyTruncate(messages, limit);
    case "summarize":
      // Actual summarization via summarizeContext action (Node.js runtime).
      // Falls back to sliding in pure Convex runtime.
      return applySliding(messages, limit);
    case "sliding":
    default:
      return applySliding(messages, limit);
  }
}

// ─── Convex: summarizeContext internalAction ──────────────────────────────────

/**
 * Summarize oldest context messages when over 80% of token limit.
 * Uses a cheap model (gpt-4o-mini by default) to compress history.
 *
 * AGE-158: Triggered automatically in mastraIntegration when strategy is "summarize".
 */
export const summarizeContext = internalAction({
  args: {
    threadId: v.id("threads"),
    provider: v.string(),
    apiKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ summary: string; tokensSaved: number }> => {
    const limit = args.limit ?? DEFAULT_TOKEN_LIMIT;

    const messages = await ctx.runQuery(api.messages.getByThread, { threadId: args.threadId as any });
    if (!messages || messages.length === 0) return { summary: "", tokensSaved: 0 };

    const typedMessages = messages as Array<{ role: string; content: string }>;
    const allMessages = typedMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    if (!shouldSummarize(allMessages, limit)) return { summary: "", tokensSaved: 0 };

    const targetTokens = Math.floor(limit * 0.8);
    let accumulatedTokens = 0;
    const toSummarize: typeof allMessages = [];

    for (const msg of allMessages) {
      const t = countTokens(msg.content);
      if (accumulatedTokens + t > targetTokens && toSummarize.length > 0) break;
      toSummarize.push(msg);
      accumulatedTokens += t;
    }

    if (toSummarize.length === 0) return { summary: "", tokensSaved: 0 };

    const prompt = `Summarize the following conversation concisely. Focus on key points, decisions, and context needed to continue the conversation:\n\n${
      toSummarize.map((m) => `${m.role}: ${m.content}`).join("\n\n")
    }`;

    const summaryAgent = new Agent({
      id: "agentforge-summarizer",
      name: "agentforge-summarizer",
      instructions: "You are a helpful assistant that summarizes conversations concisely.",
      model: { providerId: args.provider, modelId: "gpt-4o-mini", apiKey: args.apiKey },
    });

    try {
      const result = await summaryAgent.generate([
        { role: "user", content: prompt },
      ] as MessageListInput);
      const summary = result.text;
      return {
        summary: `[Previous conversation summary: ${summary}]`,
        tokensSaved: Math.max(0, accumulatedTokens - countTokens(summary)),
      };
    } catch (err) {
      console.error("Summarization failed:", err);
      return { summary: "", tokensSaved: 0 };
    }
  },
});

export const summarizeAction = summarizeContext;
