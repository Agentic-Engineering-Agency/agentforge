import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('AGE-170: File Storage Implementation', () => {
  const projectRoot = join(__dirname, '..');

  describe('Convex Backend: Schema and Functions', () => {
    it('files schema should include storageId field', () => {
      const schemaPath = join(projectRoot, 'packages/cli/templates/default/convex/schema.ts');
      const schema = readFileSync(schemaPath, 'utf-8');
      expect(schema).toMatch(/storageId:\s*v\.optional\(v\.string\(\)\)/);
    });

    it('files.ts should export generateUploadUrl mutation', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/convex/files.ts');
      const files = readFileSync(filesPath, 'utf-8');
      expect(files).toMatch(/export\s+const\s+generateUploadUrl\s*=/);
      expect(files).toMatch(/ctx\.storage\.generateUploadUrl\(\)/);
    });

    it('files.ts should export getFileUrl query', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/convex/files.ts');
      const files = readFileSync(filesPath, 'utf-8');
      expect(files).toMatch(/export\s+const\s+getFileUrl\s*=/);
      expect(files).toMatch(/ctx\.storage\.getUrl\(/);
    });

    it('files:create mutation should accept storageId parameter', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/convex/files.ts');
      const files = readFileSync(filesPath, 'utf-8');
      expect(files).toMatch(/create\s*=\s*mutation\(/);
      expect(files).toMatch(/storageId:\s*v\.optional\(v\.string\(\)\)/);
    });

    it('dist/default and templates/default files.ts should be identical', () => {
      const distPath = join(projectRoot, 'packages/cli/dist/default/convex/files.ts');
      const templatePath = join(projectRoot, 'packages/cli/templates/default/convex/files.ts');
      const distContent = readFileSync(distPath, 'utf-8');
      const templateContent = readFileSync(templatePath, 'utf-8');
      expect(distContent).toBe(templateContent);
    });
  });

  describe('CLI: Upload Command', () => {
    it('upload command should implement 3-step flow', () => {
      const cliPath = join(projectRoot, 'packages/cli/src/commands/files.ts');
      const cli = readFileSync(cliPath, 'utf-8');
      
      // Should call generateUploadUrl
      expect(cli).toMatch(/generateUploadUrl/);
      
      // Should POST to upload URL
      expect(cli).toMatch(/fetch\(uploadUrl/);
      expect(cli).toMatch(/method:\s*['"]POST['"]/);
      
      // Should extract storageId from response
      expect(cli).toMatch(/storageId/);
      
      // Should call files:create (storageId will be in the object literal)
      expect(cli).toMatch(/client\.mutation\('files:create'/);
      
      // Should NOT have the old pending-upload message
      expect(cli).not.toMatch(/pending-upload/);
      expect(cli).not.toMatch(/File content storage requires Convex file storage/);
    });
  });

  describe('CLI: Download Command', () => {
    it('download command should exist', () => {
      const cliPath = join(projectRoot, 'packages/cli/src/commands/files.ts');
      const cli = readFileSync(cliPath, 'utf-8');
      expect(cli).toMatch(/\.command\(['"]download['"]\)/);
    });

    it('download command should call getFileUrl', () => {
      const cliPath = join(projectRoot, 'packages/cli/src/commands/files.ts');
      const cli = readFileSync(cliPath, 'utf-8');
      expect(cli).toMatch(/getFileUrl/);
    });

    it('download command should fetch and save file bytes', () => {
      const cliPath = join(projectRoot, 'packages/cli/src/commands/files.ts');
      const cli = readFileSync(cliPath, 'utf-8');
      expect(cli).toMatch(/fetch\(fileUrl\)/);
      expect(cli).toMatch(/writeFile/);
    });
  });

  describe('Security: Input Validation', () => {
    it('generateUploadUrl should have empty args object (no injection possible)', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/convex/files.ts');
      const files = readFileSync(filesPath, 'utf-8');
      // Match the generateUploadUrl function with args: {}
      expect(files).toMatch(/generateUploadUrl\s*=\s*mutation\([\s\S]*?args:\s*\{\s*\}/);
    });

    it('getFileUrl should validate storageId as string', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/convex/files.ts');
      const files = readFileSync(filesPath, 'utf-8');
      // Match the getFileUrl function with storageId arg
      expect(files).toMatch(/getFileUrl\s*=\s*query\([\s\S]*?args:\s*\{\s*storageId:\s*v\.string\(\)/);
    });

    it('files:create should validate all inputs', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/convex/files.ts');
      const files = readFileSync(filesPath, 'utf-8');
      
      // Required fields should have validation
      expect(files).toMatch(/name:\s*v\.string\(\)/);
      expect(files).toMatch(/originalName:\s*v\.string\(\)/);
      expect(files).toMatch(/mimeType:\s*v\.string\(\)/);
      expect(files).toMatch(/size:\s*v\.number\(\)/);
      
      // Optional fields should use v.optional
      expect(files).toMatch(/storageId:\s*v\.optional\(v\.string\(\)\)/);
      expect(files).toMatch(/folderId:\s*v\.optional\(v\.id\(/);
    });
  });
});
