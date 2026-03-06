import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// Resolve notes path from CWD so it works whether running from source or compiled dist.
// Override with AGENTFORGE_NOTES_PATH env var for custom locations.
const NOTES_PATH = process.env.AGENTFORGE_NOTES_PATH
  ?? join(process.cwd(), 'data', 'notes.json');

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function loadNotes(): Note[] {
  if (!existsSync(NOTES_PATH)) {
    return [];
  }
  try {
    const data = readFileSync(NOTES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]): void {
  mkdirSync(dirname(NOTES_PATH), { recursive: true });
  writeFileSync(NOTES_PATH, JSON.stringify(notes, null, 2), 'utf-8');
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
    notes: z.array(z.any()).optional(),
    note: z.any().optional(),
  }),
  execute: async ({ action, id, content, title }) => {
    const notes = loadNotes();
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
        saveNotes(notes);
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
        saveNotes(notes);
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
        saveNotes(notes);
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
