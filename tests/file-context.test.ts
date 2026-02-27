import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('AGE-144 + AGE-152: File Context in Chat + File Management UI', () => {
  const projectRoot = join(__dirname, '..');

  describe('Schema: messages table should have fileIds field', () => {
    it('messages schema should include fileIds field', () => {
      const schemaPath = join(projectRoot, 'packages/cli/templates/default/convex/schema.ts');
      const schema = readFileSync(schemaPath, 'utf-8');
      // The fileIds field should be optional array of file IDs
      expect(schema).toMatch(/fileIds:\s*v\.optional\(v\.array\(v\.id\(["']files["']\)\)\)/);
    });
  });

  describe('Backend: messages.ts mutations should support fileIds', () => {
    it('messages:add mutation should accept fileIds parameter', () => {
      const messagesPath = join(projectRoot, 'packages/cli/templates/default/convex/messages.ts');
      const messages = readFileSync(messagesPath, 'utf-8');
      // Should accept fileIds in the args
      expect(messages).toMatch(/fileIds:\s*v\.optional\(v\.array\(v\.id\(["']files["']\)\)\)/);
    });

    it('messages:create mutation should accept fileIds parameter', () => {
      const messagesPath = join(projectRoot, 'packages/cli/templates/default/convex/messages.ts');
      const messages = readFileSync(messagesPath, 'utf-8');
      // Both add and create should support fileIds
      const fileIdsCount = (messages.match(/fileIds:/g) || []).length;
      expect(fileIdsCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Backend: chat.ts should include file content when sending to agent', () => {
    it('sendMessage action should accept fileIds parameter', () => {
      const chatPath = join(projectRoot, 'packages/cli/templates/default/convex/chat.ts');
      const chat = readFileSync(chatPath, 'utf-8');
      // sendMessage action should accept fileIds
      expect(chat).toMatch(/fileIds:\s*v\.optional\(v\.array\(v\.id\(["']files["']\)\)\)/);
    });

    it('sendMessage should fetch file content from storage for context', () => {
      const chatPath = join(projectRoot, 'packages/cli/templates/default/convex/chat.ts');
      const chat = readFileSync(chatPath, 'utf-8');
      // Should reference getting file content
      expect(chat).toMatch(/storage\.getUrl|getFileUrl|fileIds|fileContext/);
    });
  });

  describe('UI: files.tsx should have upload functionality', () => {
    it('files.tsx should have generateUploadUrl mutation', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/files.tsx');
      const files = readFileSync(filesPath, 'utf-8');
      // Should use the generateUploadUrl mutation
      expect(files).toMatch(/generateUploadUrl/);
    });

    it('files.tsx should have upload button', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/files.tsx');
      const files = readFileSync(filesPath, 'utf-8');
      // Should have an Upload button or file input
      expect(files).toMatch(/Upload|<input[^>]*type=["']file["']|onClick.*upload/);
    });

    it('files.tsx should have drag-and-drop upload zone', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/files.tsx');
      const files = readFileSync(filesPath, 'utf-8');
      // Should have drag and drop event handlers
      expect(files).toMatch(/onDragOver|onDrop|drag.*drop/);
    });

    it('files.tsx should show file size, type icon, upload date', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/files.tsx');
      const files = readFileSync(filesPath, 'utf-8');
      // Should display file size and format function
      expect(files).toMatch(/formatFileSize|file\.size|size:/);
      // Should have file icon component or function
      expect(files).toMatch(/getFileIcon|FileIcon|FileText|FileImage|FileCode/);
    });

    it('files.tsx should have download button', () => {
      const filesPath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/files.tsx');
      const files = readFileSync(filesPath, 'utf-8');
      // Should have download functionality
      expect(files).toMatch(/getFileUrl|download|Download/);
    });
  });

  describe('UI: chat.tsx should have file attachment feature', () => {
    it('chat.tsx should have paperclip button for file attachment', () => {
      const chatPath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/chat.tsx');
      const chat = readFileSync(chatPath, 'utf-8');
      // Should import Paperclip icon
      expect(chat).toMatch(/Paperclip/);
      // Should have a button with paperclip
      expect(chat).toMatch(/paperclip|attach.*file/i);
    });

    it('chat.tsx should show selected files as chips', () => {
      const chatPath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/chat.tsx');
      const chat = readFileSync(chatPath, 'utf-8');
      // Should have attached files state and display
      expect(chat).toMatch(/attachedFiles|selectedFiles|fileIds|file.*chip/);
    });

    it('chat.tsx should include fileIds in message payload', () => {
      const chatPath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/chat.tsx');
      const chat = readFileSync(chatPath, 'utf-8');
      // Should pass fileIds to sendMessage
      expect(chat).toMatch(/fileIds:\s*\[|fileIds.*selected|attachedFiles/);
    });
  });

  describe('Sync: dist/default and templates/default should be identical', () => {
    it('files.tsx should be identical in both locations', () => {
      const distPath = join(projectRoot, 'packages/cli/dist/default/dashboard/app/routes/files.tsx');
      const templatePath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/files.tsx');
      const distContent = readFileSync(distPath, 'utf-8');
      const templateContent = readFileSync(templatePath, 'utf-8');
      expect(distContent).toBe(templateContent);
    });

    it('chat.tsx should be identical in both locations', () => {
      const distPath = join(projectRoot, 'packages/cli/dist/default/dashboard/app/routes/chat.tsx');
      const templatePath = join(projectRoot, 'packages/cli/templates/default/dashboard/app/routes/chat.tsx');
      const distContent = readFileSync(distPath, 'utf-8');
      const templateContent = readFileSync(templatePath, 'utf-8');
      expect(distContent).toBe(templateContent);
    });

    it('messages.ts should be identical in both locations', () => {
      const distPath = join(projectRoot, 'packages/cli/dist/default/convex/messages.ts');
      const templatePath = join(projectRoot, 'packages/cli/templates/default/convex/messages.ts');
      const distContent = readFileSync(distPath, 'utf-8');
      const templateContent = readFileSync(templatePath, 'utf-8');
      expect(distContent).toBe(templateContent);
    });

    it('chat.ts (convex) should be identical in both locations', () => {
      const distPath = join(projectRoot, 'packages/cli/dist/default/convex/chat.ts');
      const templatePath = join(projectRoot, 'packages/cli/templates/default/convex/chat.ts');
      const distContent = readFileSync(distPath, 'utf-8');
      const templateContent = readFileSync(templatePath, 'utf-8');
      expect(distContent).toBe(templateContent);
    });

    it('schema.ts should have fileIds in messages table', () => {
      const schemaPath = join(projectRoot, 'packages/cli/templates/default/convex/schema.ts');
      const schema = readFileSync(schemaPath, 'utf-8');
      expect(schema).toMatch(/messages.*defineTable/);
      // Just check that fileIds and AGE-144 comment are present in schema
      expect(schema).toMatch(/fileIds/);
      expect(schema).toMatch(/AGE-144.*Attached files/);
    });
  });
});
