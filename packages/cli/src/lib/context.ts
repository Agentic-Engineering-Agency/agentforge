/**
 * Context Window Management - Pure Functions (AGE-158 + AGE-177)
 *
 * Pure functions for context management that can be tested without Convex dependencies.
 * These are shared between the CLI and Convex backend.
 *
 * CLI-specific functions (getContext, readEnvValue) have been moved to cli-context.ts.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/** Default token limit for context window */
export const DEFAULT_TOKEN_LIMIT = 8000;

/**
 * CLI context interface for deployment configuration.
 */
export interface CliContext {
  deployUrl: string;
}

/**
 * Read a value from .env files in the current directory.
 * Copied from channel commands for consistency.
 */
function readEnvValue(key: string): string | undefined {
  const cwd = process.cwd();
  const envFiles = ['.env.local', '.env', '.env.production'];
  for (const envFile of envFiles) {
    try {
      const filePath = join(cwd, envFile);
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const [envKey, ...envValueParts] = line.split('=');
        if (envKey.trim() === key && envValueParts.length > 0) {
          return envValueParts.join('=').trim();
        }
      }
    } catch (error) {
      console.debug('[readEnvValue] Failed to read env file %s:', envFile, error instanceof Error ? error.message : error);
    }
  }
  return undefined;
}

/**
 * Get the CLI context including Convex deployment URL.
 * Reads from environment variables or .env files.
 *
 * @throws {Error} If CONVEX_URL is not found
 * @returns The CLI context with deployment URL
 */
export function getContext(): CliContext {
  const deployUrl = readEnvValue('CONVEX_URL') || process.env.CONVEX_URL;

  if (!deployUrl) {
    throw new Error(
      'CONVEX_URL not found. Run `npx convex dev` first, or set CONVEX_URL in your .env file.'
    );
  }

  return { deployUrl };
}

/** Supported context strategies */
export type ContextStrategy = "sliding" | "truncate" | "summarize";

/** Message shape compatible with Mastra and Convex */
export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * Count approximate tokens in text.
 * Uses the heuristic: 4 characters ≈ 1 token.
 * This is a rough approximation that works well for English text.
 * For more accuracy, you would use tiktoken or similar.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens in an array of messages.
 */
export function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + countTokens(m.content), 0);
}

/**
 * Apply sliding window strategy: drop oldest messages when over limit.
 * Keeps the most recent messages that fit within the token limit.
 */
export function applySliding(messages: Message[], limit = DEFAULT_TOKEN_LIMIT): Message[] {
  if (messages.length === 0 || limit <= 0) return [];

  // Start from the end (most recent) and work backwards
  const result: Message[] = [];
  let currentTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = countTokens(msg.content);

    if (currentTokens + msgTokens <= limit) {
      result.unshift(msg);
      currentTokens += msgTokens;
    }

    // Always include the most recent message if possible
    if (i === messages.length - 1 && !result.includes(msg)) {
      // Truncate the single message if needed to fit
      const maxContentChars = limit * 4;
      if (maxContentChars > 0) {
        const truncated: Message = {
          role: msg.role,
          content: msg.content.slice(0, maxContentChars),
        };
        result.unshift(truncated);
      }
      break;
    }
  }

  return result;
}

/**
 * Apply truncate strategy: drop oldest messages when over limit.
 * This is functionally identical to sliding window for now.
 */
export function applyTruncate(messages: Message[], limit = DEFAULT_TOKEN_LIMIT): Message[] {
  return applySliding(messages, limit);
}

/**
 * Determine if summarization should be triggered.
 * Returns true when messages exceed 80% of the token limit.
 */
export function shouldSummarize(messages: Message[], limit = DEFAULT_TOKEN_LIMIT): boolean {
  const tokens = countMessagesTokens(messages);
  return tokens > limit * 0.8;
}

/**
 * Apply the appropriate context strategy based on agent configuration.
 * This is the main entry point for context management.
 *
 * @param messages - The messages to process
 * @param strategy - The context strategy to apply
 * @param limit - The token limit
 * @returns Processed messages fitting within the token limit
 */
export function applyContextStrategy(
  messages: Message[],
  strategy: ContextStrategy = "sliding",
  limit = DEFAULT_TOKEN_LIMIT
): Message[] {
  switch (strategy) {
    case "truncate":
      return applyTruncate(messages, limit);
    case "summarize":
      // For now, summarize falls back to sliding when not in Node.js runtime
      // The actual summarization happens via summarizeContext action
      return applySliding(messages, limit);
    case "sliding":
    default:
      return applySliding(messages, limit);
  }
}
