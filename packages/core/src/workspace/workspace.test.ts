/**
 * @module workspace/workspace.test
 *
 * TDD tests for createWorkspace factory.
 * WRITTEN FIRST - tests should fail until implementation exists.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWorkspace } from './index.js';
import { rm } from 'node:fs/promises';

describe('createWorkspace', () => {
  const testBasePath = '/tmp/test-agentforge-workspace';
  const testEnv = process.env;

  beforeEach(async () => {
    // Clean up test directory
    await rm(testBasePath, { recursive: true, force: true });
    // Reset environment
    process.env = { ...testEnv };
    delete process.env.AGENTFORGE_STORAGE;
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testBasePath, { recursive: true, force: true });
    // Restore environment
    process.env = testEnv;
  });

  describe('local storage', () => {
    it('returns object with read/write methods when storage is local', () => {
      const workspace = createWorkspace({
        storage: 'local',
        basePath: testBasePath,
      });

      expect(workspace).toBeDefined();
      expect(typeof workspace.read).toBe('function');
      expect(typeof workspace.write).toBe('function');
      expect(typeof workspace.list).toBe('function');
      expect(typeof workspace.delete).toBe('function');
      expect(typeof workspace.exists).toBe('function');
    });

    it('write then read returns same content', async () => {
      const workspace = createWorkspace({
        storage: 'local',
        basePath: testBasePath,
      });

      await workspace.write('test.txt', 'Hello, World!');
      const content = await workspace.read('test.txt');

      expect(content).toBe('Hello, World!');
    });

    it('list returns array of paths', async () => {
      const workspace = createWorkspace({
        storage: 'local',
        basePath: testBasePath,
      });

      await workspace.write('file1.txt', 'content1');
      await workspace.write('file2.txt', 'content2');
      await workspace.write('subdir/file3.txt', 'content3');

      const files = await workspace.list();

      expect(files).toEqual(expect.arrayContaining([
        'file1.txt',
        'file2.txt',
        'subdir/file3.txt',
      ]));
    });

    it('exists returns true for written file', async () => {
      const workspace = createWorkspace({
        storage: 'local',
        basePath: testBasePath,
      });

      await workspace.write('test.txt', 'content');

      expect(await workspace.exists('test.txt')).toBe(true);
      expect(await workspace.exists('nonexistent.txt')).toBe(false);
    });

    it('delete removes file', async () => {
      const workspace = createWorkspace({
        storage: 'local',
        basePath: testBasePath,
      });

      await workspace.write('test.txt', 'content');
      expect(await workspace.exists('test.txt')).toBe(true);

      await workspace.delete('test.txt');
      expect(await workspace.exists('test.txt')).toBe(false);
    });
  });

  describe('environment variable toggle', () => {
    it('AGENTFORGE_STORAGE=local selects local storage', () => {
      process.env.AGENTFORGE_STORAGE = 'local';

      const workspace = createWorkspace({
        basePath: testBasePath,
      });

      // Should work with local filesystem operations
      expect(typeof workspace.write).toBe('function');
    });

    it('defaults to local when AGENTFORGE_STORAGE is not set', () => {
      delete process.env.AGENTFORGE_STORAGE;

      const workspace = createWorkspace({
        basePath: testBasePath,
      });

      expect(typeof workspace.write).toBe('function');
    });
  });

  describe('S3 storage', () => {
    it('creates S3 workspace when storage is s3', () => {
      const workspace = createWorkspace({
        storage: 's3',
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });

      expect(workspace).toBeDefined();
      expect(typeof workspace.read).toBe('function');
      expect(typeof workspace.write).toBe('function');
    });
  });

  describe('R2 storage', () => {
    it('creates R2 workspace when storage is r2', () => {
      const workspace = createWorkspace({
        storage: 'r2',
        bucket: 'test-bucket',
        endpoint: 'https://example.com',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });

      expect(workspace).toBeDefined();
      expect(typeof workspace.read).toBe('function');
      expect(typeof workspace.write).toBe('function');
    });
  });
});
