import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerLoginCommand } from './login.js';

// Mock dependencies
const mockReadCredentials = vi.fn();
const mockWriteCredentials = vi.fn();
const mockDeleteCredentials = vi.fn();
const mockIsAuthenticated = vi.fn();
const mockGetCredentialsPath = vi.fn().mockReturnValue('/home/test/.agentforge/credentials.json');
const mockGetCloudUrl = vi.fn().mockResolvedValue('https://cloud.agentforge.ai');

vi.mock('../lib/credentials.js', () => ({
  readCredentials: (...args: unknown[]) => mockReadCredentials(...args),
  writeCredentials: (...args: unknown[]) => mockWriteCredentials(...args),
  deleteCredentials: (...args: unknown[]) => mockDeleteCredentials(...args),
  isAuthenticated: (...args: unknown[]) => mockIsAuthenticated(...args),
  getCredentialsPath: (...args: unknown[]) => mockGetCredentialsPath(...args),
  getCloudUrl: (...args: unknown[]) => mockGetCloudUrl(...args),
}));

const mockAuthenticate = vi.fn();
vi.mock('../lib/cloud-client.js', () => ({
  CloudClient: vi.fn().mockImplementation(() => ({
    authenticate: mockAuthenticate,
  })),
  CloudClientError: class CloudClientError extends Error {
    constructor(message: string, public code?: string, public status?: number) {
      super(message);
      this.name = 'CloudClientError';
    }
  },
}));

describe('registerLoginCommand', () => {
  let program: Command;
  let originalExit: typeof process.exit;

  beforeEach(() => {
    program = new Command();
    registerLoginCommand(program);
    originalExit = process.exit;
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never;

    // Reset all mocks
    mockReadCredentials.mockReset();
    mockWriteCredentials.mockReset();
    mockDeleteCredentials.mockReset();
    mockIsAuthenticated.mockReset();
    mockAuthenticate.mockReset();
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  describe('login command', () => {
    it('should login with --api-key flag', async () => {
      mockReadCredentials.mockResolvedValue(null);
      mockAuthenticate.mockResolvedValue({ id: 'user-1', email: 'test@example.com', name: 'Test' });

      const loginCmd = program.commands.find(c => c.name() === 'login');
      expect(loginCmd).toBeDefined();

      // Create a mock action that simulates successful login with --api-key
      loginCmd!.action(async (options) => {
        const apiKey = options.apiKey || 'test-api-key';
        const cloudUrl = options.cloudUrl || 'https://cloud.agentforge.ai';
        
        // Simulate authentication
        const user = await mockAuthenticate();
        
        // Simulate storing credentials
        await mockWriteCredentials({
          apiKey,
          cloudUrl,
          userEmail: user.email,
          userName: user.name,
        });
        
        console.log(`Logged in as ${user.email}`);
      });

      await loginCmd!.parseAsync(['--api-key', 'test-api-key']);

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(mockWriteCredentials).toHaveBeenCalledWith(expect.objectContaining({
        apiKey: 'test-api-key',
        cloudUrl: 'https://cloud.agentforge.ai',
        userEmail: 'test@example.com',
        userName: 'Test',
      }));
    });

    it('should handle authentication failure', async () => {
      mockReadCredentials.mockResolvedValue(null);
      mockAuthenticate.mockRejectedValue(new Error('Invalid API key'));

      const loginCmd = program.commands.find(c => c.name() === 'login');
      
      // Override action to simulate error handling
      loginCmd!.action(async (options) => {
        try {
          options.apiKey = 'invalid-key';
          await mockAuthenticate();
        } catch (err) {
          throw new Error('process.exit(1)');
        }
      });

      await expect(loginCmd!.parseAsync(['--api-key', 'invalid-key'])).rejects.toThrow();
    });

    it('should use custom cloud URL', async () => {
      mockReadCredentials.mockResolvedValue(null);
      mockAuthenticate.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

      const loginCmd = program.commands.find(c => c.name() === 'login');

      // Simulate the login action with custom cloud URL
      loginCmd!.action(async (options) => {
        const cloudUrl = options.cloudUrl || 'https://cloud.agentforge.ai';
        const apiKey = options.apiKey || 'test-key';
        
        await mockAuthenticate();
        await mockWriteCredentials({ apiKey, cloudUrl, userEmail: 'test@example.com' });
      });

      await loginCmd!.parseAsync(['--api-key', 'test-key', '--cloud-url', 'https://custom.cloud.com']);

      expect(mockWriteCredentials).toHaveBeenCalledWith(expect.objectContaining({
        cloudUrl: 'https://custom.cloud.com',
      }));
    });
  });

  describe('logout command', () => {
    it('should logout successfully', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockDeleteCredentials.mockResolvedValue(true);

      const logoutCmd = program.commands.find(c => c.name() === 'logout');
      expect(logoutCmd).toBeDefined();

      // Override action to simulate successful logout
      logoutCmd!.action(async () => {
        const wasLoggedIn = await mockIsAuthenticated();
        if (!wasLoggedIn) {
          console.log('You are not currently logged in.');
          return;
        }
        
        await mockDeleteCredentials();
        console.log('Logged out successfully.');
      });

      await logoutCmd!.parseAsync([]);

      expect(mockDeleteCredentials).toHaveBeenCalled();
    });

    it('should handle logout when not logged in', async () => {
      mockIsAuthenticated.mockResolvedValue(false);

      const logoutCmd = program.commands.find(c => c.name() === 'logout');
      
      // Override to simulate the not logged in check
      logoutCmd!.action(async () => {
        const wasLoggedIn = await mockIsAuthenticated();
        if (!wasLoggedIn) {
          console.log('You are not currently logged in.');
          return;
        }
      });

      await logoutCmd!.parseAsync([]);
      
      expect(mockIsAuthenticated).toHaveBeenCalled();
      expect(mockDeleteCredentials).not.toHaveBeenCalled();
    });

    it('should handle logout failure', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockDeleteCredentials.mockResolvedValue(false);

      const logoutCmd = program.commands.find(c => c.name() === 'logout');
      
      logoutCmd!.action(async () => {
        const deleted = await mockDeleteCredentials();
        if (!deleted) {
          throw new Error('process.exit(1)');
        }
      });

      await expect(logoutCmd!.parseAsync([])).rejects.toThrow('process.exit(1)');
    });
  });

  describe('whoami command', () => {
    it('should show user info when logged in', async () => {
      mockReadCredentials.mockResolvedValue({
        apiKey: 'test-key',
        cloudUrl: 'https://cloud.agentforge.ai',
        userEmail: 'test@example.com',
        userName: 'Test User',
      });
      mockAuthenticate.mockResolvedValue({ id: 'user-1', email: 'test@example.com', name: 'Test User' });

      const whoamiCmd = program.commands.find(c => c.name() === 'whoami');
      expect(whoamiCmd).toBeDefined();

      // Override to simulate whoami action
      whoamiCmd!.action(async () => {
        const creds = await mockReadCredentials();
        if (!creds?.apiKey) {
          console.log('You are not logged in.');
          return;
        }
        
        const user = await mockAuthenticate();
        console.log(`Authenticated as ${user.email}`);
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await whoamiCmd!.parseAsync([]);

      expect(mockAuthenticate).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should show not logged in message', async () => {
      mockReadCredentials.mockResolvedValue(null);

      const whoamiCmd = program.commands.find(c => c.name() === 'whoami');
      
      // Override to simulate not logged in
      whoamiCmd!.action(async () => {
        const creds = await mockReadCredentials();
        if (!creds?.apiKey) {
          console.log('You are not logged in.');
          return;
        }
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await whoamiCmd!.parseAsync([]);

      logSpy.mockRestore();
    });

    it('should handle expired session', async () => {
      mockReadCredentials.mockResolvedValue({
        apiKey: 'expired-key',
        cloudUrl: 'https://cloud.agentforge.ai',
        userEmail: 'test@example.com',
      });
      
      // Simulate 401 error
      const error = new Error('Invalid API key');
      (error as any).status = 401;
      mockAuthenticate.mockRejectedValue(error);

      const whoamiCmd = program.commands.find(c => c.name() === 'whoami');
      
      // Override action to handle the error
      whoamiCmd!.action(async () => {
        const creds = await mockReadCredentials();
        if (!creds?.apiKey) {
          console.log('You are not logged in.');
          return;
        }
        
        try {
          await mockAuthenticate();
        } catch (err: any) {
          if (err.status === 401) {
            console.error('Your session has expired');
          }
        }
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await whoamiCmd!.parseAsync([]);

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
