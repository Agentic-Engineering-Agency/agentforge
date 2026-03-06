import type { Agent } from '@mastra/core/agent';

/**
 * Shared utilities for channel adapters
 */

/**
 * Progressive streaming for chat channels (Discord, Telegram)
 * Posts initial "thinking" message, then edits it as content arrives
 *
 * @param agent - Mastra agent instance
 * @param message - User message text
 * @param opts - Thread and resource options
 * @param onChunk - Callback with accumulated text and done flag
 * @param editIntervalMs - How often to call onChunk during streaming (default 1500ms)
 * @returns Final response text
 */
export async function progressiveStream(
  agent: Agent,
  message: string,
  opts: { threadId?: string; resourceId?: string; editIntervalMs?: number },
  onChunk: (text: string, done: boolean) => Promise<void>,
  editIntervalMs = 1500,
): Promise<string> {
  // Mastra agent.stream() expects messages array and optional execution options
  const streamOptions =
    opts.threadId && opts.resourceId
      ? { memory: { thread: opts.threadId, resource: opts.resourceId } }
      : undefined;
  const stream = await agent.stream([{ role: 'user', content: message }], streamOptions);
  let buffer = '';
  let lastEdit = Date.now();

  try {
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'text-delta') {
        buffer += chunk.payload.text;
        const now = Date.now();
        if (now - lastEdit > editIntervalMs) {
          await onChunk(buffer, false);
          lastEdit = now;
        }
      }
    }
    // Final update with complete response
    await onChunk(buffer, true);
    return buffer;
  } catch (error) {
    // On stream error: finalize with whatever we accumulated so the caller
    // can display partial content instead of leaving "Thinking..." stuck.
    await onChunk(buffer, true);
    throw error;
  }
}

/**
 * Split message into chunks respecting platform character limits
 * Handles code blocks, markdown formatting, and prevents mid-word splits
 *
 * @param text - Full message text
 * @param maxLength - Maximum characters per chunk (2000 for Discord, 4096 for Telegram)
 * @returns Array of message chunks
 */
export function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];

  // Handle empty string: return one empty chunk so callers always have at least one element
  if (!text) return [''];

  // If text fits in one chunk, return it (trim trailing whitespace)
  if (text.length <= maxLength) {
    return [text.trimEnd()];
  }

  // Find all code blocks to preserve them
  const codeBlocks: Array<{ start: number; end: number; text: string }> = [];
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }

  // If there are code blocks, split at their boundaries
  if (codeBlocks.length > 0) {
    let lastIndex = 0;
    for (const block of codeBlocks) {
      // Add text before code block
      if (block.start > lastIndex) {
        const beforeText = text.slice(lastIndex, block.start);
        chunks.push(...splitTextSimple(beforeText, maxLength));
      }
      // Add code block as a single unit (split if too long)
      if (block.text.length > maxLength) {
        chunks.push(...splitTextSimple(block.text, maxLength));
      } else {
        chunks.push(block.text);
      }
      lastIndex = block.end;
    }
    // Add remaining text after last code block
    if (lastIndex < text.length) {
      const afterText = text.slice(lastIndex);
      chunks.push(...splitTextSimple(afterText, maxLength));
    }
  } else {
    // No code blocks, just split plain text
    chunks.push(...splitTextSimple(text, maxLength));
  }

  return chunks;
}

/**
 * Helper function to split text at maxLength
 */
function splitTextSimple(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  // Trim trailing whitespace from each chunk
  return chunks.map(c => c.trimEnd());
}

/**
 * Format OpenAI-compatible SSE chunk
 */
export function formatSSEChunk(content: string, finishReason: 'stop' | 'length' | null = null): string {
  const chunk = {
    id: `chunk-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'agentforge',
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: finishReason,
      },
    ],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Generate thread ID for channel-user pair
 * Format: {channel}:{userId}
 */
export function generateThreadId(channel: string, userId: string): string {
  return `${channel}:${userId}`;
}
