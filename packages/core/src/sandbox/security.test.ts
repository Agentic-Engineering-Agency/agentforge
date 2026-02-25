/**
 * Unit tests for security helpers.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  SecurityError,
  validateBind,
  validateBinds,
  validateImageName,
  validateCommand,
  BLOCKED_BIND_PREFIXES,
} from './security.js';

describe('validateBind()', () => {
  it('allows a safe bind mount', () => {
    expect(() => validateBind('/home/user/workspace:/workspace:ro')).not.toThrow();
  });

  it('allows a bind mount without mode', () => {
    expect(() => validateBind('/tmp/data:/data')).not.toThrow();
  });

  for (const blocked of BLOCKED_BIND_PREFIXES) {
    it(`blocks ${blocked}`, () => {
      expect(() => validateBind(`${blocked}:/mnt:ro`)).toThrow(SecurityError);
    });
  }

  it('blocks sub-paths of blocked prefixes', () => {
    expect(() => validateBind('/etc/passwd:/etc/passwd:ro')).toThrow(SecurityError);
  });

  it('throws on empty bind spec', () => {
    expect(() => validateBind('')).toThrow(SecurityError);
  });
});

describe('validateBinds()', () => {
  it('validates all binds in the array', () => {
    expect(() =>
      validateBinds(['/home/user/a:/a:ro', '/home/user/b:/b:rw']),
    ).not.toThrow();
  });

  it('throws on the first blocked bind', () => {
    expect(() =>
      validateBinds(['/home/user/safe:/safe', '/proc/self:/proc:ro']),
    ).toThrow(SecurityError);
  });
});

describe('validateImageName()', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalEnv;
    }
    delete process.env['AGENTFORGE_ALLOWED_IMAGES'];
  });

  it('allows any plausible image in non-production', () => {
    process.env['NODE_ENV'] = 'test';
    expect(() => validateImageName('my-custom-image:latest')).not.toThrow();
  });

  it('allows node: images in production', () => {
    process.env['NODE_ENV'] = 'production';
    expect(() => validateImageName('node:22-slim')).not.toThrow();
  });

  it('allows python: images in production', () => {
    process.env['NODE_ENV'] = 'production';
    expect(() => validateImageName('python:3.12')).not.toThrow();
  });

  it('allows agentforge/ images in production', () => {
    process.env['NODE_ENV'] = 'production';
    expect(() => validateImageName('agentforge/sandbox:latest')).not.toThrow();
  });

  it('blocks unknown images in production', () => {
    process.env['NODE_ENV'] = 'production';
    expect(() => validateImageName('evil-image:latest')).toThrow(SecurityError);
  });

  it('allows custom prefixes via AGENTFORGE_ALLOWED_IMAGES', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['AGENTFORGE_ALLOWED_IMAGES'] = 'custom-registry/,my-org/';
    expect(() => validateImageName('custom-registry/myimage:v1')).not.toThrow();
  });

  it('rejects empty image name', () => {
    expect(() => validateImageName('')).toThrow(SecurityError);
  });

  it('rejects image names with shell metacharacters', () => {
    expect(() => validateImageName('image;rm -rf /')).toThrow(SecurityError);
    expect(() => validateImageName('image$(whoami)')).toThrow(SecurityError);
    expect(() => validateImageName('image|cat /etc/passwd')).toThrow(SecurityError);
  });
});

describe('validateCommand()', () => {
  it('allows normal commands', () => {
    expect(() => validateCommand('echo hello')).not.toThrow();
    expect(() => validateCommand('node -e "console.log(1)"')).not.toThrow();
    expect(() => validateCommand('python3 script.py')).not.toThrow();
  });

  it('blocks docker.sock access attempts', () => {
    expect(() => validateCommand('curl --unix-socket /var/run/docker.sock http://localhost/containers/json')).toThrow(SecurityError);
  });

  it('blocks nsenter attempts', () => {
    expect(() => validateCommand('nsenter --target 1 --mount --uts --ipc --net --pid')).toThrow(SecurityError);
  });

  it('rejects empty command', () => {
    expect(() => validateCommand('')).toThrow(SecurityError);
  });
});
