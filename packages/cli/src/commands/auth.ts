/**
 * Auth commands for dashboard password management.
 */

import { Command } from 'commander';
import { getContext } from '../context.js';
import { ConvexClient } from 'convex/browser';

export const authCommand = new Command('auth');

authCommand.description('Manage dashboard authentication');

// Set password command
authCommand
  .command('set-password')
  .description('Set the dashboard password (for local/self-hosted deployments)')
  .argument('<password>', 'Password to set')
  .option('-v, --verbose', 'Verbose output')
  .action(async (password, options) => {
    const ctx = getContext();
    const convex = new ConvexClient(ctx.deployUrl);

    try {
      const result = await convex.mutation('auth:setPassword', { password });

      if (options.verbose) {
        console.log('Password set successfully');
        console.log('User ID:', result.userId);
        console.log('Updated:', result.updated);
      } else {
        console.log('✓ Dashboard password set successfully');
        console.log('  Access your dashboard at:', ctx.deployUrl.replace('.convex.cloud', '.convex.cloud'));
      }
    } catch (error) {
      console.error('Failed to set password:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Status command
authCommand
  .command('status')
  .description('Check dashboard authentication status')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const ctx = getContext();
    const convex = new ConvexClient(ctx.deployUrl);

    try {
      // Check if password is set
      const passwordResult = await convex.query('auth:validatePassword', {
        password: 'dummy-check',
      });

      const hasPassword = passwordResult.valid === false; // If false, password exists (just wrong)

      if (options.verbose) {
        console.log('Auth Status:');
        console.log('  Password Set:', hasPassword);
        console.log('  Deployment:', ctx.deployUrl);
      } else {
        if (hasPassword) {
          console.log('✓ Dashboard is password protected');
        } else {
          console.log('⚠ Dashboard password not set');
          console.log('  Run: agentforge auth set-password <password>');
        }
      }
    } catch (error) {
      console.error('Failed to check auth status:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Generate API key command
authCommand
  .command('generate-key')
  .description('Generate an API key for dashboard access')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const ctx = getContext();
    const convex = new ConvexClient(ctx.deployUrl);

    try {
      const result = await convex.mutation('auth:generateApiKey', {});

      if (options.verbose) {
        console.log('API Key Generated:');
        console.log('  Key:', result.apiKey);
      } else {
        console.log('✓ API Key generated:');
        console.log('  ', result.apiKey);
        console.log('  Use this key in the Authorization header: Bearer', result.apiKey);
      }
    } catch (error) {
      console.error('Failed to generate API key:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Validate key command
authCommand
  .command('validate-key')
  .description('Validate an API key')
  .argument('<key>', 'API key to validate')
  .option('-v, --verbose', 'Verbose output')
  .action(async (key, options) => {
    const ctx = getContext();
    const convex = new ConvexClient(ctx.deployUrl);

    try {
      const result = await convex.query('auth:validateApiKey', { apiKey: key });

      if (options.verbose) {
        console.log('Validation Result:', result);
      } else {
        if (result.valid) {
          console.log('✓ API key is valid');
        } else {
          console.log('✗ API key is invalid');
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('Failed to validate API key:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Create session command
authCommand
  .command('create-session')
  .description('Create a session token for dashboard access')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const ctx = getContext();
    const convex = new ConvexClient(ctx.deployUrl);

    try {
      const result = await convex.mutation('auth:createSession', {});

      if (options.verbose) {
        console.log('Session Created:');
        console.log('  Token:', result.token);
        console.log('  Expires At:', new Date(result.expiresAt).toISOString());
      } else {
        console.log('✓ Session token created:');
        console.log('  ', result.token);
        console.log('  Expires:', new Date(result.expiresAt).toLocaleString());
      }
    } catch (error) {
      console.error('Failed to create session:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
