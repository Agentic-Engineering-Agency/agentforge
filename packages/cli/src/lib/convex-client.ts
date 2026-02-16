import { ConvexHttpClient } from 'convex/browser';
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Get the Convex deployment URL from the project's .env files
 */
function getConvexUrl(): string {
  const cwd = process.cwd();
  const envFiles = ['.env.local', '.env', '.env.production'];

  for (const envFile of envFiles) {
    const envPath = path.join(cwd, envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/CONVEX_URL\s*=\s*(.+)/);
      if (match) {
        return match[1].trim().replace(/["']/g, '');
      }
    }
  }

  // Also check .env.local in convex directory
  const convexEnv = path.join(cwd, '.convex', 'deployment.json');
  if (fs.existsSync(convexEnv)) {
    try {
      const data = JSON.parse(fs.readFileSync(convexEnv, 'utf-8'));
      if (data.url) return data.url;
    } catch {
      // ignore
    }
  }

  throw new Error(
    'CONVEX_URL not found. Run `npx convex dev` first, or set CONVEX_URL in your .env file.'
  );
}

/**
 * Create a Convex HTTP client connected to the project's deployment
 */
export function createClient(): ConvexHttpClient {
  const url = getConvexUrl();
  return new ConvexHttpClient(url);
}

/**
 * Safely call a Convex query/mutation and handle errors
 */
export async function safeCall<T>(
  fn: () => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (error.message?.includes('CONVEX_URL not found')) {
      console.error('\n❌ Not connected to Convex.');
      console.error('   Run `npx convex dev` in your project directory first.\n');
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      console.error('\n❌ Cannot reach Convex deployment.');
      console.error('   Make sure `npx convex dev` is running.\n');
    } else {
      console.error(`\n❌ ${errorMessage}`);
      console.error(`   ${error.message}\n`);
    }
    process.exit(1);
  }
}
