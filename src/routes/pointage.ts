import { Hono } from 'hono';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { pointageRecords, tradeCatalog, subcontractors } from '../db/schema';
import {
  validatePointageRecordCreate,
  validatePointageRecordUpdate,
  validatePointageQuery,
} from '../validation/middleware';
import type { PointageRecordCreateInput, PointageRecordUpdateInput, PointageQueryInput } from '../validation/schemas';

export const pointageRouter = new Hono();

pointageRouter.get('/projects/:projectId/pointage', validatePointageQuery, async (c) => {
  const projectId = c.req.param('projectId') as string;
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

pointageRouter.post('/projects/:projectId/pointage', validatePointageRecordCreate, async (c) => {
  const projectId = c.req.param('projectId') as string;
  const input = c.req.valid('json') as PointageRecordCreateInput;
  const [record] = await db.insert(pointageRecords).values({
    projectId,
    tradeId: input.tradeId,
    count: input.count,
    isCompanyTrade: input.isCompanyTrade ? 1 : 0,
    subcontractorId: input.subcontractorId,
  } as any).returning();

  return c.json(record, 201);
});

pointageRouter.patch('/pointage/:id', validatePointageRecordUpdate, async (c) => {
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

pointageRouter.delete('/pointage/:id', async (c) => {
  const id = c.req.param('id');
  const [deleted] = await db.delete(pointageRecords).where(eq(pointageRecords.id, id)).returning();
  if (!deleted) return c.json({ error: 'Pointage record not found' }, 404);
  return c.json({ deleted: true });
});

pointageRouter.get('/trade-catalog', async (c) => {
  const result = await db.select().from(tradeCatalog);
  return c.json(result);
});
