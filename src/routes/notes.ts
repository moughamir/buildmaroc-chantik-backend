import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { and, eq } from 'drizzle-orm';
import { notes } from '../db/schema';
import {
  noteCreateSchema,
  noteUpdateSchema,
  noteSelectSchema,
  deletedResponseSchema,
} from '../validation/schemas';
import type { NoteCreateInput, NoteUpdateInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';
import { requireProjectInOrg } from '../middleware/tenant';

// Mounted at /api/v1/projects/:projectId/notes — `projectId` comes from the
// mount prefix (Hono merges it into params at runtime), so the route-local
// paths below only declare `{noteId}`.
// L6c: shared 400 validation shape { error: { message, issues } } for invalid
// bodies / params / query (defaultHook) and malformed JSON (onError).
export const notesApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const notesListRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['notes'],
  responses: {
    200: {
      description: 'List notes for the project',
      content: { 'application/json': { schema: z.array(noteSelectSchema) } },
    },
  },
});

notesApp.openapi(notesListRoute, async (c) => {
  const projectId = c.req.param('projectId') as string;
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const result = await db.select().from(notes).where(eq(notes.projectId, projectId));
  return c.json(result);
});

const noteCreateRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['notes'],
  request: {
    body: { content: { 'application/json': { schema: noteCreateSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Note created',
      content: { 'application/json': { schema: noteSelectSchema } },
    },
  },
});

notesApp.openapi(noteCreateRoute, async (c) => {
  const projectId = c.req.param('projectId') as string;
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const userId = ((c as any).get('userId') as string) || '';
  const input = c.req.valid('json') as NoteCreateInput;
  const [note] = await db.insert(notes).values({
    projectId,
    createdById: userId,
    content: input.content,
  } as any).returning();

  return c.json(note, 201);
});

const notePatchRoute = createRoute({
  method: 'patch',
  path: '/{noteId}',
  tags: ['notes'],
  request: {
    params: z.object({ noteId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: noteUpdateSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Note updated',
      content: { 'application/json': { schema: noteSelectSchema } },
    },
    404: {
      description: 'Note not found',
    },
  },
});

notesApp.openapi(notePatchRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const noteId = c.req.param('noteId');
  const input = c.req.valid('json') as NoteUpdateInput;
  const updates: Record<string, unknown> = {};
  if (input.content !== undefined) updates.content = input.content;

  const [note] = await db.update(notes)
    .set(updates)
    .where(and(eq(notes.id, noteId), eq(notes.projectId, projectId)))
    .returning();

  if (!note) return c.json({ error: 'Note not found' }, 404);
  return c.json(note);
});

const noteDeleteRoute = createRoute({
  method: 'delete',
  path: '/{noteId}',
  tags: ['notes'],
  request: {
    params: z.object({ noteId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Note deleted',
      content: { 'application/json': { schema: deletedResponseSchema } },
    },
    404: {
      description: 'Note not found',
    },
  },
});

notesApp.openapi(noteDeleteRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const noteId = c.req.param('noteId');
  const [deleted] = await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.projectId, projectId))).returning();
  if (!deleted) return c.json({ error: 'Note not found' }, 404);
  return c.json({ deleted: true });
});
