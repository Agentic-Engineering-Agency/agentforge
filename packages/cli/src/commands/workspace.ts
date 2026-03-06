import { Command } from 'commander';
import { mkdir, readdir, stat, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { header, success, error, info, dim, warn } from '../lib/display.js';
import { createWorkspace } from '@agentforge-ai/core';

export function registerWorkspaceCommand(program: Command) {
  const ws = program.command('workspace').description('Manage agent workspace and skills');

  ws
    .command('init')
    .option('--dir <dir>', 'Project directory', '.')
    .description('Initialize workspace directories (workspace/ and skills/)')
    .action(async (opts) => {
      const base = resolve(opts.dir);
      const workspaceDir = join(base, 'workspace');
      const skillsDir = join(base, 'skills');
      await mkdir(workspaceDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });
      success(`Workspace initialized:`);
      info(`  workspace/  — agent file storage`);
      info(`  skills/     — SKILL.md skills (agentskills.io format)`);
      dim(`\nPlace SKILL.md folders in skills/ for agents to discover them.`);
    });

  ws
    .command('status')
    .option('--dir <dir>', 'Project directory', '.')
    .description('Show workspace status and discovered skills')
    .action(async (opts) => {
      const base = resolve(opts.dir);
      const workspaceDir = join(base, 'workspace');
      const skillsDir = join(base, 'skills');

      header('Workspace Status');

      // Filesystem
      if (existsSync(workspaceDir)) {
        const files = await readdir(workspaceDir).catch(() => []);
        info(`Filesystem: ${workspaceDir}`);
        dim(`  ${files.length} item(s)`);
      } else {
        info(`Filesystem: not initialized`);
        dim(`  Run: agentforge workspace init`);
      }

      // Skills
      if (existsSync(skillsDir)) {
        const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
        const skills = entries.filter(e => e.isDirectory());
        info(`\nSkills: ${skillsDir}`);
        if (skills.length === 0) {
          dim(`  No skills installed.`);
          dim(`  Run: agentforge skills create <name>`);
        } else {
          for (const skill of skills) {
            const skillMd = join(skillsDir, skill.name, 'SKILL.md');
            dim(`  ✓ ${skill.name}${existsSync(skillMd) ? '' : ' (missing SKILL.md)'}`);
          }
        }
      } else {
        info(`\nSkills: not initialized`);
      }
    });

  ws
    .command('config')
    .option('--storage <type>', 'Storage backend: local, s3, r2')
    .option('--bucket <name>', 'Bucket name (for S3/R2)')
    .option('--endpoint <url>', 'S3-compatible endpoint URL (required for R2)')
    .option('--region <region>', 'AWS region or "auto" for R2')
    .option('--key <key>', 'Access key ID')
    .option('--secret <secret>', 'Secret access key')
    .description('Configure workspace storage backend')
    .action(async (opts) => {
      const { storage, bucket, endpoint, region, key, secret } = opts;

      if (!storage) {
        error('Storage type is required. Use --storage <local|s3|r2>');
        info('\nExamples:');
        dim('  agentforge workspace config --storage local');
        dim('  agentforge workspace config --storage r2 --bucket my-bucket --endpoint https://example.com --key KEY --secret SECRET');
        dim('  agentforge workspace config --storage s3 --bucket my-bucket --region us-east-1 --key KEY --secret SECRET');
        return;
      }

      if (!['local', 's3', 'r2'].includes(storage)) {
        error(`Invalid storage type: ${storage}`);
        info('Valid options: local, s3, r2');
        return;
      }

      if (storage === 's3' || storage === 'r2') {
        if (!bucket) {
          error('--bucket <name> is required for S3/R2 storage');
          return;
        }
        if (!key || !secret) {
          error('--key and --secret are required for S3/R2 storage');
          return;
        }
        if (storage === 'r2' && !endpoint) {
          warn('R2 typically requires --endpoint URL');
          info('Example: --endpoint https://<accountid>.r2.cloudflarestorage.com');
        }
      }

      // Set environment variable for persistence
      process.env.AGENTFORGE_STORAGE = storage;

      header(`Workspace Storage Configured`);
      info(`Storage type: ${storage}`);
      if (storage === 'local') {
        info(`Base path: ./workspace (default)`);
        dim(`\nTo customize base path, set AGENTFORGE_BASE_PATH environment variable.`);
      } else {
        info(`Bucket: ${bucket}`);
        if (region) info(`Region: ${region}`);
        if (endpoint) info(`Endpoint: ${endpoint}`);
        dim(`\nConfiguration saved to AGENTFORGE_STORAGE environment variable.`);
        dim(`Credentials should be stored in environment variables for production use.`);
      }
    });

  ws
    .command('test')
    .option('--storage <type>', 'Storage backend to test')
    .option('--bucket <name>', 'Bucket name (for S3/R2)')
    .option('--endpoint <url>', 'S3-compatible endpoint URL')
    .option('--region <region>', 'AWS region')
    .option('--key <key>', 'Access key ID')
    .option('--secret <secret>', 'Secret access key')
    .option('--base-path <path>', 'Base path for local storage', '/tmp/agentforge-workspace-test')
    .description('Test workspace storage by writing and reading a file')
    .action(async (opts) => {
      header('Workspace Storage Test');

      const storage = opts.storage ?? process.env.AGENTFORGE_STORAGE ?? 'local';

      // Build workspace config
      const config: any = { storage };
      if (storage === 'local') {
        config.basePath = opts.basePath;
      } else {
        config.bucket = opts.bucket;
        config.region = opts.region ?? (storage === 'r2' ? 'auto' : 'us-east-1');
        config.endpoint = opts.endpoint;
        config.accessKeyId = opts.key;
        config.secretAccessKey = opts.secret;
      }

      try {
        info(`Creating ${storage} workspace...`);
        const workspace = createWorkspace(config);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Workspace filesystem methods vary by backend
        const fs = (workspace as any).filesystem ?? workspace;

        const testPath = `agentforge-test-${Date.now()}.txt`;
        const testContent = `AgentForge workspace test at ${new Date().toISOString()}`;

        info(`Writing test file: ${testPath}`);
        await fs.write(testPath, testContent);

        info(`Reading test file...`);
        const readContent = await fs.read(testPath);

        if (readContent === testContent) {
          success(`✓ Storage test passed!`);
          info(`Written and read: "${testContent}"`);

          // Clean up test file
          info(`Cleaning up test file...`);
          await fs.delete(testPath);
          success(`✓ Test file deleted`);

          info(`\n✓ ${storage.toUpperCase()} storage is working correctly.`);
        } else {
          error(`✗ Content mismatch!`);
          error(`Expected: ${testContent}`);
          error(`Got: ${readContent}`);
        }
      } catch (err) {
        error(`✗ Storage test failed!`);
        error((err as Error).message);
        if (storage !== 'local') {
          info(`\nTroubleshooting:`);
          dim(`• Verify bucket name and credentials are correct`);
          dim(`• For R2, check that endpoint URL is correct`);
          dim(`• For S3, check that region is correct`);
          dim(`• Ensure your access key has write permissions`);
        }
      }
    });
}
