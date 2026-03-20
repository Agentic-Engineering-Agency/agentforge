/**
 * CLI Context - CLI-specific context utilities (AGE-177)
 *
 * This file contains CLI-specific functions that read from the filesystem
 * and environment variables. Pure context functions are in context.ts.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/** CLI context interface for deployment configuration. */
export interface CliContext {
  deployUrl: string;
}

/**
 * Read a value from .env files in the current directory.
 * Strips surrounding quotes from values (single or double).
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
          // Strip surrounding quotes (single or double) from the value
          const value = envValueParts.join('=').trim();
          return value.replace(/^["']|["']$/g, '');
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
