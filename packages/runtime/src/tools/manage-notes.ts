import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOTES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../data');
const NOTES_PATH = join(NOTES_DIR, 'notes.json');

const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type Note = z.infer<typeof NoteSchema>;

async function loadNotes(): Promise<Note[]> {
  try {
    const data = await readFile(NOTES_PATH, 'utf-8');
    return z.array(NoteSchema).parse(JSON.parse(data));
  } catch {
    return [];
  }
}

async function saveNotes(notes: Note[]): Promise<void> {
  await mkdir(NOTES_DIR, { recursive: true });
  await writeFile(NOTES_PATH, JSON.stringify(notes, null, 2), 'utf-8');
}

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const manageNotesTool = createTool({
  id: 'manage-notes',
  description: 'Create, read, update, delete persistent notes.',
  inputSchema: z.object({
    action: z.enum(['create', 'read', 'update', 'delete', 'list']),
    id: z.string().optional(),
    content: z.string().optional(),
    title: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    notes: z.array(NoteSchema).optional(),
    note: NoteSchema.optional(),
  }),
  execute: async ({ action, id, content, title }) => {
    const notes = await loadNotes();
    const now = new Date().toISOString();

    switch (action) {
      case 'create': {
        if (!title || !content) {
          throw new Error('Title and content are required for create action');
        }
        const newNote: Note = {
          id: generateId(),
          title,
          content,
          createdAt: now,
          updatedAt: now,
        };
        notes.push(newNote);
        await saveNotes(notes);
        return { success: true, note: newNote };
      }

      case 'read': {
        if (!id) {
          throw new Error('ID is required for read action');
        }
        const note = notes.find(n => n.id === id);
        if (!note) {
          throw new Error(`Note not found: ${id}`);
        }
        return { success: true, note };
      }

      case 'update': {
        if (!id) {
          throw new Error('ID is required for update action');
        }
        const index = notes.findIndex(n => n.id === id);
        if (index === -1) {
          throw new Error(`Note not found: ${id}`);
        }
        const note = notes[index];
        if (title !== undefined) note.title = title;
        if (content !== undefined) note.content = content;
        note.updatedAt = now;
        notes[index] = note;
        await saveNotes(notes);
        return { success: true, note };
      }

      case 'delete': {
        if (!id) {
          throw new Error('ID is required for delete action');
        }
        const index = notes.findIndex(n => n.id === id);
        if (index === -1) {
          throw new Error(`Note not found: ${id}`);
        }
        notes.splice(index, 1);
        await saveNotes(notes);
        return { success: true };
      }

      case 'list': {
        return { success: true, notes };
      }

      default:
        return { success: false };
    }
  },
});
