import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { notes } from '../db/schema';
import {
  validateNoteCreate,
  validateNoteUpdate,
} from '../validation/middleware';
import type { NoteCreateInput, NoteUpdateInput } from '../validation/schemas';

export const notesRouter = new Hono();

notesRouter.get('/', async (c) => {
  const projectId = c.req.param('projectId') as string;
  const result = await db.select().from(notes).where(eq(notes.projectId, projectId));
  return c.json(result);
});

notesRouter.post('/', validateNoteCreate, async (c) => {
  const projectId = c.req.param('projectId') as string;
  const userId = ((c as any).get('userId') as string) || '';
  const input = c.req.valid('json') as NoteCreateInput;
  const [note] = await db.insert(notes).values({
    projectId,
    createdById: userId,
    content: input.content,
  } as any).returning();

  return c.json(note, 201);
});

notesRouter.patch('/:noteId', validateNoteUpdate, async (c) => {
  const projectId = c.req.param('projectId') as string;
  const noteId = c.req.param('noteId') as string;
  const input = c.req.valid('json') as NoteUpdateInput;
  const updates: Record<string, unknown> = {};
  if (input.content !== undefined) updates.content = input.content;

  const [note] = await db.update(notes)
    .set(updates)
    .where(eq(notes.id, noteId))
    .returning();

  if (!note) return c.json({ error: 'Note not found' }, 404);
  return c.json(note);
});

notesRouter.delete('/:noteId', async (c) => {
  const projectId = c.req.param('projectId');
  const noteId = c.req.param('noteId');
  const [deleted] = await db.delete(notes).where(eq(notes.id, noteId)).returning();
  if (!deleted) return c.json({ error: 'Note not found' }, 404);
  return c.json({ deleted: true });
});
