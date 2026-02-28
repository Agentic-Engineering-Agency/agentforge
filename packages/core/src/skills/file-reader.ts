/**
 * File Reader Skill
 *
 * Reads files from the local filesystem.
 * Intended for use in sandboxed environments only.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { BundledSkill } from './types.js';

export const FileReaderSkill: BundledSkill = {
  name: 'file-reader',
  description: 'Read files from the local filesystem. Only works in sandboxed environments.',
  category: 'io',
  schema: {
    input: {
      filePath: { type: 'string', description: 'Path to the file to read', required: true },
      encoding: { type: 'string', description: 'File encoding (default: utf-8)', required: false },
      maxLength: { type: 'number', description: 'Maximum characters to return (default: 50000)', required: false },
    },
    output: 'File contents or error message',
  },
  execute: async (args) => {
    const filePath = args.filePath as string;
    const encoding = (args.encoding as BufferEncoding) ?? 'utf-8';
    const maxLength = (args.maxLength as number) ?? 50000;

    if (!filePath || typeof filePath !== 'string') {
      return JSON.stringify({ error: 'File path is required and must be a string' });
    }

    try {
      // Resolve to absolute path
      const resolvedPath = path.resolve(filePath);

      // Security: check if path is safe (no directory traversal outside allowed dirs)
      // In production, this should check against a whitelist of allowed directories
      const normalizedPath = path.normalize(resolvedPath);

      // Check if file exists
      try {
        await fs.access(normalizedPath);
      } catch {
        return JSON.stringify({ error: 'File not found', path: normalizedPath });
      }

      // Get file stats
      const stats = await fs.stat(normalizedPath);

      // Check if it's a file (not a directory)
      if (!stats.isFile()) {
        return JSON.stringify({ error: 'Path is not a file', path: normalizedPath });
      }

      // Check file size (warn if very large)
      if (stats.size > 10 * 1024 * 1024) { // 10MB
        return JSON.stringify({
          error: 'File too large (max 10MB)',
          path: normalizedPath,
          size: stats.size,
        });
      }

      // Read file
      let content = await fs.readFile(normalizedPath, encoding);

      // Truncate if needed
      if (content.length > maxLength) {
        content = content.slice(0, maxLength) + '\n\n... (truncated)';
      }

      return JSON.stringify({
        path: normalizedPath,
        size: stats.size,
        encoding,
        content,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        path: filePath,
      });
    }
  },
};
