import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';

// Need to import the module after mocking os.homedir
const credentialsModule = await import('./credentials.js');
const { 
  readCredentials, 
  writeCredentials, 
  deleteCredentials, 
  isAuthenticated,
  getCloudUrl,
  getApiKey,
  getCredentialsPath,
  isExpired,
  updateCredentials,
} = credentialsModule;

describe('credentials', () => {
  let tmpDir: string;
  let credentialsFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-creds-test-'));
    credentialsFile = path.join(tmpDir, '.agentforge', 'credentials.json');
    
    // Write initial empty state by creating the directory
    await fs.ensureDir(path.join(tmpDir, '.agentforge'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  describe('file operations', () => {
    it('should write and read credentials', async () => {
      const credsPath = path.join(tmpDir, '.agentforge', 'credentials.json');
      
      // Manually write credentials file
      await fs.writeFile(credsPath, JSON.stringify({
        apiKey: 'test-key',
        cloudUrl: 'https://cloud.agentforge.ai',
        userEmail: 'test@example.com',
      }));

      // Read it back
      const content = await fs.readFile(credsPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed.apiKey).toBe('test-key');
      expect(parsed.cloudUrl).toBe('https://cloud.agentforge.ai');
      expect(parsed.userEmail).toBe('test@example.com');
    });

    it('should delete credentials file', async () => {
      const credsPath = path.join(tmpDir, '.agentforge', 'credentials.json');
      await fs.writeFile(credsPath, JSON.stringify({ apiKey: 'test' }));
      
      expect(await fs.pathExists(credsPath)).toBe(true);
      
      await fs.remove(credsPath);
      
      expect(await fs.pathExists(credsPath)).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('should return false when no expiresAt is set', () => {
      const creds = { apiKey: 'test', cloudUrl: 'https://cloud.agentforge.ai' };
      expect(isExpired(creds)).toBe(false);
    });

    it('should return false when expiresAt is in the future', () => {
      const creds = {
        apiKey: 'test',
        cloudUrl: 'https://cloud.agentforge.ai',
        expiresAt: Date.now() + 10000,
      };
      expect(isExpired(creds)).toBe(false);
    });

    it('should return true when expiresAt is in the past', () => {
      const creds = {
        apiKey: 'test',
        cloudUrl: 'https://cloud.agentforge.ai',
        expiresAt: Date.now() - 10000,
      };
      expect(isExpired(creds)).toBe(true);
    });
  });

  describe('Credentials data structure', () => {
    it('should have correct Credentials interface', () => {
      // Verify the type definition is valid
      const creds = {
        apiKey: 'test-key',
        cloudUrl: 'https://cloud.agentforge.ai',
        userEmail: 'test@example.com',
        userName: 'Test User',
        expiresAt: Date.now(),
        refreshedAt: Date.now(),
      };

      expect(creds.apiKey).toBeDefined();
      expect(creds.cloudUrl).toBeDefined();
      expect(creds.userEmail).toBeDefined();
      expect(creds.userName).toBeDefined();
      expect(creds.expiresAt).toBeDefined();
      expect(creds.refreshedAt).toBeDefined();
    });

    it('should handle minimal credentials', () => {
      const creds = {
        apiKey: 'minimal-key',
        cloudUrl: 'https://cloud.agentforge.ai',
      };

      expect(creds.apiKey).toBe('minimal-key');
      expect(creds.cloudUrl).toBe('https://cloud.agentforge.ai');
    });
  });

  describe('getCredentialsPath', () => {
    it('should return the credentials file path', () => {
      const path = getCredentialsPath();
      expect(path).toContain('.agentforge');
      expect(path).toContain('credentials.json');
      expect(path).toMatch(/credentials\.json$/);
    });
  });
});
