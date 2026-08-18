import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { pointageRecords, tradeCatalog, subcontractors } from '../db/schema';
import {
  pointageRecordCreateSchema,
  pointageRecordUpdateSchema,
  pointageQuerySchema,
  pointageRecordSelectSchema,
  tradeCatalogSelectSchema,
  deletedResponseSchema,
} from '../validation/schemas';
import type { PointageRecordCreateInput, PointageRecordUpdateInput, PointageQueryInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

// Mounted at /api/v1.
// L6c: shared 400 validation shape { error: { message, issues } } for invalid
// bodies / params / query (defaultHook) and malformed JSON (onError).
export const pointageApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const pointageListRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/pointage',
  tags: ['pointage'],
  request: {
    params: z.object({ projectId: z.string().uuid() }),
    query: pointageQuerySchema,
  },
  responses: {
    200: {
      description: 'List pointage records for a project and date',
      content: { 'application/json': { schema: z.array(pointageRecordSelectSchema) } },
    },
  },
});

pointageApp.openapi(pointageListRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const query = c.req.valid('query') as PointageQueryInput;
  const dateFilter = query.date ? new Date(query.date) : new Date();

  const result = await db
    .select()
    .from(pointageRecords)
    .where(and(
      eq(pointageRecords.projectId, projectId),
      sql`${pointageRecords.date}::date = ${dateFilter.toISOString().split('T')[0]}`
    ))
    .orderBy(desc(pointageRecords.createdAt));

  return c.json(result);
});

const pointageCreateRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/pointage',
  tags: ['pointage'],
  request: {
    params: z.object({ projectId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: pointageRecordCreateSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Pointage record created',
      content: { 'application/json': { schema: pointageRecordSelectSchema } },
    },
  },
});

pointageApp.openapi(pointageCreateRoute, async (c) => {
  const projectId = c.req.param('projectId') as string;
  const input = c.req.valid('json') as PointageRecordCreateInput;
  const [record] = await db.insert(pointageRecords).values({
    projectId,
    // L6e: `pointage_records.date` is NOT NULL with no default — default to
    // today so a valid body returns 201 instead of a DB error.
    date: new Date(),
    tradeId: input.tradeId,
    count: input.count,
    isCompanyTrade: input.isCompanyTrade ? 1 : 0,
    subcontractorId: input.subcontractorId,
  } as any).returning();

  return c.json(record, 201);
});

const pointagePatchRoute = createRoute({
  method: 'patch',
  path: '/pointage/{id}',
  tags: ['pointage'],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: pointageRecordUpdateSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Pointage record updated',
      content: { 'application/json': { schema: pointageRecordSelectSchema } },
    },
    404: {
      description: 'Pointage record not found',
    },
  },
});

pointageApp.openapi(pointagePatchRoute, async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json') as PointageRecordUpdateInput;
  const updates: Record<string, unknown> = {};
  if (input.count !== undefined) updates.count = input.count;

  const [record] = await db.update(pointageRecords)
    .set(updates)
    .where(eq(pointageRecords.id, id))
    .returning();

  if (!record) return c.json({ error: 'Pointage record not found' }, 404);
  return c.json(record);
});

const pointageDeleteRoute = createRoute({
  method: 'delete',
  path: '/pointage/{id}',
  tags: ['pointage'],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Pointage record deleted',
      content: { 'application/json': { schema: deletedResponseSchema } },
    },
    404: {
      description: 'Pointage record not found',
    },
  },
});

pointageApp.openapi(pointageDeleteRoute, async (c) => {
  const id = c.req.param('id');
  const [deleted] = await db.delete(pointageRecords).where(eq(pointageRecords.id, id)).returning();
  if (!deleted) return c.json({ error: 'Pointage record not found' }, 404);
  return c.json({ deleted: true });
});

const pointageValidateRoute = createRoute({
  method: 'patch',
  path: '/projects/{projectId}/pointage/validate',
  tags: ['pointage'],
  request: {
    params: z.object({ projectId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            date: z.string().datetime(),
            validated: z.boolean(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Pointage records validated (or unvalidated) for a project and date',
      content: { 'application/json': { schema: z.object({ updated: z.number().int() }) } },
    },
  },
});

pointageApp.openapi(pointageValidateRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as { date: string; validated: boolean };
  const dateFilter = new Date(input.date);

  const updated = await db
    .update(pointageRecords)
    .set({
      isValidated: input.validated,
      validatedAt: input.validated ? new Date() : null,
    })
    .where(and(
      eq(pointageRecords.projectId, projectId),
      sql`${pointageRecords.date}::date = ${dateFilter.toISOString().split('T')[0]}`
    ))
    .returning({ id: pointageRecords.id });

  return c.json({ updated: updated.length });
});

const tradeCatalogRoute = createRoute({
  method: 'get',
  path: '/trade-catalog',
  tags: ['pointage'],
  responses: {
    200: {
      description: 'List the trade catalog',
      content: { 'application/json': { schema: z.array(tradeCatalogSelectSchema) } },
    },
  },
});

pointageApp.openapi(tradeCatalogRoute, async (c) => {
  const result = await db.select().from(tradeCatalog);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Subcontractors
// ---------------------------------------------------------------------------

const subcontractorBodySchema = z.object({
  company: z.string().min(1),
  specialty: z.string().min(1),
});

const subcontractorSelectSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  company: z.string(),
  specialty: z.string(),
  createdAt: z.string().datetime(),
});

const subcontractorsListRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/subcontractors',
  tags: ['pointage'],
  request: {
    params: z.object({ projectId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'List subcontractors for a project',
      content: { 'application/json': { schema: z.array(subcontractorSelectSchema) } },
    },
  },
});

pointageApp.openapi(subcontractorsListRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(subcontractors).where(eq(subcontractors.projectId, projectId));
  return c.json(result);
});

const subcontractorCreateRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/subcontractors',
  tags: ['pointage'],
  request: {
    params: z.object({ projectId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: subcontractorBodySchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Subcontractor created',
      content: { 'application/json': { schema: subcontractorSelectSchema } },
    },
  },
});

pointageApp.openapi(subcontractorCreateRoute, async (c) => {
  const projectId = c.req.param('projectId') as string;
  const input = c.req.valid('json') as z.infer<typeof subcontractorBodySchema>;
  const [record] = await db.insert(subcontractors).values({
    projectId,
    company: input.company,
    specialty: input.specialty,
  }).returning();

  return c.json(record, 201);
});

const subcontractorDeleteRoute = createRoute({
  method: 'delete',
  path: '/subcontractors/{id}',
  tags: ['pointage'],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Subcontractor deleted',
      content: { 'application/json': { schema: deletedResponseSchema } },
    },
    404: {
      description: 'Subcontractor not found',
    },
  },
});

pointageApp.openapi(subcontractorDeleteRoute, async (c) => {
  const id = c.req.param('id');
  const [deleted] = await db.delete(subcontractors).where(eq(subcontractors.id, id)).returning();
  if (!deleted) return c.json({ error: 'Subcontractor not found' }, 404);
  return c.json({ deleted: true });
});
