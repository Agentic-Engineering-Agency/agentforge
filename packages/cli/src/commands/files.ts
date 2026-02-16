import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, success, error, info, formatDate } from '../lib/display.js';
import fs from 'fs-extra';
import path from 'node:path';

export function registerFilesCommand(program: Command) {
  const files = program.command('files').description('Manage files');

  files
    .command('list')
    .argument('[folder]', 'Folder ID to list files from')
    .option('--json', 'Output as JSON')
    .description('List files')
    .action(async (folder, opts) => {
      const client = createClient();
      const args = folder ? { folderId: folder } : {};
      const result = await safeCall(() => client.query('files:list' as any, args), 'Failed to list files');
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Files');
      const items = (result as any[]) || [];
      if (items.length === 0) { info('No files. Upload one with: agentforge files upload <path>'); return; }
      table(items.map((f: any) => ({
        ID: f._id?.slice(-8) || 'N/A',
        Name: f.name,
        Type: f.mimeType,
        Size: formatSize(f.size),
        Folder: f.folderId || 'root',
        Created: formatDate(f.createdAt),
      })));
    });

  files
    .command('upload')
    .argument('<filepath>', 'Path to file to upload')
    .option('--folder <id>', 'Folder ID to upload to')
    .option('--project <id>', 'Project ID to associate with')
    .description('Upload a file')
    .action(async (filepath, opts) => {
      const absPath = path.resolve(filepath);
      if (!fs.existsSync(absPath)) { error(`File not found: ${absPath}`); process.exit(1); }

      const stat = fs.statSync(absPath);
      const name = path.basename(absPath);
      const ext = path.extname(absPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
        '.js': 'text/javascript', '.ts': 'text/typescript', '.py': 'text/x-python',
        '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.csv': 'text/csv', '.html': 'text/html', '.xml': 'text/xml',
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      const client = createClient();
      await safeCall(
        () => client.mutation('files:create' as any, {
          name, mimeType, size: stat.size,
          folderId: opts.folder, projectId: opts.project,
        }),
        'Failed to upload file metadata'
      );
      success(`File "${name}" registered (${formatSize(stat.size)}, ${mimeType}).`);
      info('Note: File content storage requires Convex file storage or R2 integration.');
    });

  files
    .command('delete')
    .argument('<id>', 'File ID')
    .description('Delete a file')
    .action(async (id) => {
      const client = createClient();
      await safeCall(() => client.mutation('files:remove' as any, { _id: id }), 'Failed to delete file');
      success(`File "${id}" deleted.`);
    });

  // Folders subcommand
  const folders = program.command('folders').description('Manage folders');

  folders
    .command('list')
    .option('--json', 'Output as JSON')
    .description('List all folders')
    .action(async (opts) => {
      const client = createClient();
      const result = await safeCall(() => client.query('folders:list' as any, {}), 'Failed to list folders');
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Folders');
      const items = (result as any[]) || [];
      if (items.length === 0) { info('No folders. Create one with: agentforge folders create <name>'); return; }
      table(items.map((f: any) => ({
        ID: f._id?.slice(-8) || 'N/A',
        Name: f.name,
        Parent: f.parentId || 'root',
        Created: formatDate(f.createdAt),
      })));
    });

  folders
    .command('create')
    .argument('<name>', 'Folder name')
    .option('--parent <id>', 'Parent folder ID')
    .description('Create a folder')
    .action(async (name, opts) => {
      const client = createClient();
      await safeCall(
        () => client.mutation('folders:create' as any, { name, parentId: opts.parent }),
        'Failed to create folder'
      );
      success(`Folder "${name}" created.`);
    });

  folders
    .command('delete')
    .argument('<id>', 'Folder ID')
    .description('Delete a folder')
    .action(async (id) => {
      const client = createClient();
      await safeCall(() => client.mutation('folders:remove' as any, { _id: id }), 'Failed to delete folder');
      success(`Folder "${id}" deleted.`);
    });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
