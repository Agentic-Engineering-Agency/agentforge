import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { execSync } from 'node:child_process';
import {
  readCredentials,
  writeCredentials,
  deleteCredentials,
  isAuthenticated,
  getCredentialsPath,
  getCloudUrl,
} from '../lib/credentials.js';
import { CloudClient, CloudClientError } from '../lib/cloud-client.js';
import { header, success, error, info, details } from '../lib/display.js';

/**
 * Register login, logout, and whoami commands
 */
export function registerLoginCommand(program: Command) {
  // Login command
  program
    .command('login')
    .description('Authenticate with AgentForge Cloud')
    .option('--api-key <key>', 'API key for authentication (skips browser flow)')
    .option('--cloud-url <url>', 'Custom AgentForge Cloud URL')
    .action(async (options) => {
      header('AgentForge Cloud Login');

      // Check if already logged in
      const existingCreds = await readCredentials();
      if (existingCreds?.apiKey) {
        const { overwrite } = await prompts({
          type: 'confirm',
          name: 'overwrite',
          message: 'You are already logged in. Overwrite existing credentials?',
          initial: false,
        });

        if (!overwrite) {
          info('Login cancelled.');
          return;
        }
      }

      let apiKey: string;
      let cloudUrl: string;

      if (options.apiKey) {
        // Use provided API key
        apiKey = options.apiKey;
        cloudUrl = options.cloudUrl || process.env.AGENTFORGE_CLOUD_URL || 'https://cloud.agentforge.ai';
      } else {
        // Interactive login or browser OAuth
        const { method } = await prompts({
          type: 'select',
          name: 'method',
          message: 'How would you like to authenticate?',
          choices: [
            { title: 'Enter API key manually', value: 'api-key' },
            { title: 'Browser (OAuth - coming soon)', value: 'browser', disabled: true },
          ],
        });

        if (method === 'api-key') {
          const response = await prompts({
            type: 'password',
            name: 'key',
            message: 'Enter your AgentForge API key:',
            validate: (value) => value.length > 0 ? true : 'API key is required',
          });
          apiKey = response.key;
        } else {
          // Browser flow placeholder
          error('Browser authentication not yet implemented. Use --api-key flag.');
          process.exit(1);
        }

        cloudUrl = options.cloudUrl || process.env.AGENTFORGE_CLOUD_URL || 'https://cloud.agentforge.ai';
      }

      // Validate the API key
      const spinner = ora('Authenticating with AgentForge Cloud...').start();

      try {
        const client = new CloudClient(cloudUrl, apiKey);
        const user = await client.authenticate();

        // Store credentials
        await writeCredentials({
          apiKey,
          cloudUrl,
          userEmail: user.email,
          userName: user.name,
        });

        spinner.succeed('Authentication successful!');

        success(`Logged in as ${chalk.bold(user.email)}`);
        info(`Cloud URL: ${cloudUrl}`);
        info(`Credentials stored at: ${getCredentialsPath()}`);
      } catch (err: any) {
        spinner.fail('Authentication failed');

        if (err instanceof CloudClientError) {
          error(err.message);
          if (err.code === 'NETWORK_ERROR') {
            info('Check your internet connection and try again.');
          } else if (err.status === 401) {
            info('Your API key appears to be invalid. Please check and try again.');
          }
        } else {
          error(`Unexpected error: ${err.message || err}`);
        }

        process.exit(1);
      }
    });

  // Logout command
  program
    .command('logout')
    .description('Clear AgentForge Cloud credentials')
    .action(async () => {
      header('AgentForge Cloud Logout');

      const wasLoggedIn = await isAuthenticated();
      
      if (!wasLoggedIn) {
        info('You are not currently logged in.');
        return;
      }

      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to log out?',
        initial: true,
      });

      if (!confirm) {
        info('Logout cancelled.');
        return;
      }

      const deleted = await deleteCredentials();
      
      if (deleted) {
        success('Logged out successfully.');
        info('Your credentials have been removed.');
      } else {
        error('Failed to remove credentials.');
        process.exit(1);
      }
    });

  // Whoami command
  program
    .command('whoami')
    .description('Show current user information')
    .action(async () => {
      header('Current User');

      const creds = await readCredentials();
      const cloudUrl = await getCloudUrl();

      if (!creds?.apiKey) {
        info('You are not logged in.');
        info('Run "agentforge login" to authenticate.');
        return;
      }

      // Display stored info
      details({
        'Cloud URL': cloudUrl,
        'Email': creds.userEmail || 'Unknown',
        'Name': creds.userName || 'Unknown',
        'Credentials File': getCredentialsPath(),
      });

      // Try to validate with the server
      const spinner = ora('Validating session...').start();

      try {
        const client = new CloudClient(creds.cloudUrl, creds.apiKey);
        const user = await client.authenticate();

        spinner.succeed('Session is valid');
        success(`Authenticated as ${chalk.bold(user.email)}`);
      } catch (err: any) {
        spinner.fail('Session validation failed');

        if (err instanceof CloudClientError && err.status === 401) {
          error('Your session has expired or the API key is invalid.');
          info('Run "agentforge login" to re-authenticate.');
        } else {
          error(`Error: ${err.message || err}`);
          info('Your credentials are stored but the server could not be reached.');
        }
      }
    });
}
