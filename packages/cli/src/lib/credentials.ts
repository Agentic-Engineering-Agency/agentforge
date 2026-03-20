import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

/**
 * AgentForge Cloud credentials storage
 * Stored in ~/.agentforge/credentials.json
 */

export interface Credentials {
  /** API key for AgentForge Cloud */
  apiKey: string;
  /** Cloud URL (defaults to https://cloud.agentforge.ai) */
  cloudUrl: string;
  /** User email or identifier */
  userEmail?: string;
  /** User display name */
  userName?: string;
  /** Token expiration timestamp */
  expiresAt?: number;
  /** Last refreshed timestamp */
  refreshedAt?: number;
}

const CREDENTIALS_DIR = path.join(os.homedir(), '.agentforge');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials.json');
const DEFAULT_CLOUD_URL = 'https://cloud.agentforge.ai';

/**
 * Ensure the credentials directory exists
 */
async function ensureCredentialsDir(): Promise<void> {
  await fs.ensureDir(CREDENTIALS_DIR);
  // Set restrictive permissions (owner read/write only)
  try {
    await fs.chmod(CREDENTIALS_DIR, 0o700);
  } catch (error) {
    console.debug('[credentials] Failed to set permissions on credentials dir:', error instanceof Error ? error.message : error);
  }
}

/**
 * Read credentials from the secure storage
 */
export async function readCredentials(): Promise<Credentials | null> {
  try {
    if (!(await fs.pathExists(CREDENTIALS_FILE))) {
      return null;
    }
    const content = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    const creds = JSON.parse(content) as Credentials;
    // Ensure cloudUrl has a default
    if (!creds.cloudUrl) {
      creds.cloudUrl = DEFAULT_CLOUD_URL;
    }
    return creds;
  } catch (error) {
    return null;
  }
}

/**
 * Write credentials to secure storage
 */
export async function writeCredentials(credentials: Credentials): Promise<void> {
  await ensureCredentialsDir();
  const data: Credentials = {
    ...credentials,
    cloudUrl: credentials.cloudUrl || DEFAULT_CLOUD_URL,
    refreshedAt: Date.now(),
  };
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  // Set restrictive permissions (owner read/write only)
  try {
    await fs.chmod(CREDENTIALS_FILE, 0o600);
  } catch (error) {
    console.debug('[credentials] Failed to set permissions on credentials file:', error instanceof Error ? error.message : error);
  }
}

/**
 * Delete credentials (logout)
 */
export async function deleteCredentials(): Promise<boolean> {
  try {
    if (await fs.pathExists(CREDENTIALS_FILE)) {
      await fs.remove(CREDENTIALS_FILE);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const creds = await readCredentials();
  return creds !== null && creds.apiKey !== undefined;
}

/**
 * Get the cloud URL (from credentials or default)
 */
export async function getCloudUrl(): Promise<string> {
  const creds = await readCredentials();
  return creds?.cloudUrl || process.env.AGENTFORGE_CLOUD_URL || DEFAULT_CLOUD_URL;
}

/**
 * Get API key (returns null if not authenticated)
 */
export async function getApiKey(): Promise<string | null> {
  const creds = await readCredentials();
  return creds?.apiKey || null;
}

/**
 * Get the credentials file path
 */
export function getCredentialsPath(): string {
  return CREDENTIALS_FILE;
}

/**
 * Check if credentials are expired
 */
export function isExpired(credentials: Credentials): boolean {
  if (!credentials.expiresAt) return false;
  return Date.now() >= credentials.expiresAt;
}

/**
 * Update credentials with new data
 */
export async function updateCredentials(updates: Partial<Credentials>): Promise<Credentials | null> {
  const current = await readCredentials();
  if (!current) return null;
  const updated = { ...current, ...updates, refreshedAt: Date.now() };
  await writeCredentials(updated);
  return updated;
}
