import type { ToolsInput } from '@mastra/core/agent';
import { datetimeTool } from './datetime.js';
import { webSearchTool } from './web-search.js';
import { readUrlTool } from './read-url.js';
import { manageNotesTool } from './manage-notes.js';

export const BUILTIN_TOOLS: Record<string, ToolsInput[string]> = {
  'get-current-datetime': datetimeTool,
  'web-search': webSearchTool,
  'read-url': readUrlTool,
  'manage-notes': manageNotesTool,
};

/**
 * Resolve a list of tool IDs into a ToolsInput map.
 * Unknown IDs are silently skipped with a warning.
 */
export function resolveTools(ids: string[]): ToolsInput {
  const resolved: ToolsInput = {};
  for (const id of ids) {
    if (id in BUILTIN_TOOLS) {
      resolved[id] = BUILTIN_TOOLS[id];
    } else {
      console.warn(`[tool-registry] Unknown tool id "${id}" — skipping`);
    }
  }
  return resolved;
}
