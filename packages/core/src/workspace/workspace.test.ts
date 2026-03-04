/**
 * @module workspace/workspace.test
 *
 * Tests for Mastra-native createWorkspace factory.
 * Verifies correct Workspace/LocalFilesystem/S3Filesystem construction.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWorkspace } from './index.js';
import { rm, mkdir } from 'node:fs/promises';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';

const testBasePath = '/tmp/test-agentforge-workspace';

beforeEach(async () => {
  await rm(testBasePath, { recursive: true, force: true });
  await mkdir(testBasePath, { recursive: true });
  delete process.env.AGENTFORGE_STORAGE;
});

afterEach(async () => {
  await rm(testBasePath, { recursive: true, force: true });
  delete process.env.AGENTFORGE_STORAGE;
});

describe('createWorkspace', () => {
  describe('local storage', () => {
    it('returns a Mastra Workspace instance', () => {
      const workspace = createWorkspace({ storage: 'local', basePath: testBasePath });
      expect(workspace).toBeInstanceOf(Workspace);
    });

    it('has a LocalFilesystem configured', () => {
      const workspace = createWorkspace({ storage: 'local', basePath: testBasePath });
      expect(workspace.filesystem).toBeInstanceOf(LocalFilesystem);
    });

    it('filesystem can write and read files', async () => {
      const workspace = createWorkspace({ storage: 'local', basePath: testBasePath });
      await workspace.filesystem!.writeFile('/test.txt', 'hello world');
      const content = await workspace.filesystem!.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content.toString()).toBe('hello world');
    });

    it('filesystem.exists() returns true for written file', async () => {
      const workspace = createWorkspace({ storage: 'local', basePath: testBasePath });
      await workspace.filesystem!.writeFile('/exists-test.txt', 'data');
      const exists = await workspace.filesystem!.exists('/exists-test.txt');
      expect(exists).toBe(true);
    });

    it('filesystem.readdir() returns entries', async () => {
      const workspace = createWorkspace({ storage: 'local', basePath: testBasePath });
      await workspace.filesystem!.writeFile('/a.txt', 'a');
      await workspace.filesystem!.writeFile('/b.txt', 'b');
      const entries = await workspace.filesystem!.readdir('/');
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('filesystem.deleteFile() removes file', async () => {
      const workspace = createWorkspace({ storage: 'local', basePath: testBasePath });
      await workspace.filesystem!.writeFile('/del.txt', 'bye');
      await workspace.filesystem!.deleteFile('/del.txt');
      const exists = await workspace.filesystem!.exists('/del.txt');
      expect(exists).toBe(false);
    });
  });

  describe('S3 storage', () => {
    it('returns a Mastra Workspace with S3Filesystem', () => {
      const workspace = createWorkspace({
        storage: 's3',
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      });
      expect(workspace).toBeInstanceOf(Workspace);
      expect(workspace.filesystem).toBeInstanceOf(S3Filesystem);
    });

    it('S3Filesystem has correct bucket', () => {
      const workspace = createWorkspace({
        storage: 's3', bucket: 'my-bucket', region: 'us-east-1',
        accessKeyId: 'k', secretAccessKey: 's',
      });
      expect((workspace.filesystem as S3Filesystem).bucket).toBe('my-bucket');
    });
  });

  describe('R2 storage', () => {
    it('returns a Mastra Workspace with S3Filesystem for R2', () => {
      const workspace = createWorkspace({
        storage: 'r2',
        bucket: 'my-r2-bucket',
        endpoint: 'https://xxx.r2.cloudflarestorage.com',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      });
      expect(workspace).toBeInstanceOf(Workspace);
      expect(workspace.filesystem).toBeInstanceOf(S3Filesystem);
    });
  });

  describe('environment variable', () => {
    it('defaults to LocalFilesystem when AGENTFORGE_STORAGE not set', () => {
      const workspace = createWorkspace({ basePath: testBasePath });
      expect(workspace.filesystem).toBeInstanceOf(LocalFilesystem);
    });

    it('uses AGENTFORGE_STORAGE=local', () => {
      process.env.AGENTFORGE_STORAGE = 'local';
      const workspace = createWorkspace({ basePath: testBasePath });
      expect(workspace.filesystem).toBeInstanceOf(LocalFilesystem);
    });
  });

  describe('error handling', () => {
    it('throws for unknown storage type', () => {
      expect(() => createWorkspace({ storage: 'unknown' as any })).toThrow('Unknown storage type');
    });
  });
});
