import fs from 'fs-extra';
import path from 'node:path';

/**
 * Safely get the current working directory.
 * Returns null if the CWD has been deleted or is inaccessible.
 */
function safeCwd(): string | null {
  try {
    return process.cwd();
  } catch {
    return null;
  }
}

/**
 * Get the Convex deployment URL from the project's .env files.
 * Called lazily — only when a command actually needs Convex.
 */
function getConvexUrl(): string {
  const cwd = safeCwd();
  if (!cwd) {
    throw new Error(
      'Current directory does not exist or is not accessible.\n' +
      'Please navigate to a valid AgentForge project directory and try again.'
    );
  }
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

  // Also check .convex/deployment.json
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
 * Create a Convex HTTP client connected to the project's deployment.
 * The ConvexHttpClient import is deferred to avoid triggering
 * process.cwd() at module load time (which crashes if CWD is gone).
 */
export async function createClient(): Promise<import('convex/browser').ConvexHttpClient> {
  const { ConvexHttpClient } = await import('convex/browser');
  const url = getConvexUrl();
  return new ConvexHttpClient(url);
}

/**
 * Safely call a Convex query/mutation and handle errors gracefully.
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
    } else if (error.message?.includes('Current directory does not exist')) {
      console.error(`\n❌ ${error.message}\n`);
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
