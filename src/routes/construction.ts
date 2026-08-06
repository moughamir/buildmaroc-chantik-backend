import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { rfis, changeOrders, equipment } from '../db/schema';

export const constructionRouter = new Hono();

constructionRouter.get('/projects/:projectId/rfis', async (c) => {
  const projectId = c.req.param('projectId') as string;
  const result = await db.select().from(rfis).where(eq(rfis.projectId, projectId));
  return c.json(result);
});

constructionRouter.post('/projects/:projectId/rfis', async (c) => {
  const projectId = c.req.param('projectId') as string;
  const userId = ((c as any).get('userId') as string) || '';
  const body = await c.req.json<any>();
  const [rfi] = await db.insert(rfis).values({
    projectId,
    rfiNumber: body.rfiNumber || 1,
    title: body.title,
    question: body.question,
    createdById: userId,
  } as any).returning();
  return c.json(rfi, 201);
});

constructionRouter.get('/projects/:projectId/change-orders', async (c) => {
  const projectId = c.req.param('projectId') as string;
  const result = await db.select().from(changeOrders).where(eq(changeOrders.projectId, projectId));
  return c.json(result);
});

constructionRouter.post('/projects/:projectId/change-orders', async (c) => {
  const projectId = c.req.param('projectId') as string;
  const userId = ((c as any).get('userId') as string) || '';
  const body = await c.req.json<any>();
  const [co] = await db.insert(changeOrders).values({
    projectId,
    coNumber: body.coNumber,
    title: body.title,
    description: body.description,
    costImpactCents: body.costImpactCents || 0,
    scheduleImpactDays: body.scheduleImpactDays || 0,
    requestedById: userId,
  } as any).returning();
  return c.json(co, 201);
});

constructionRouter.get('/projects/:projectId/equipment', async (c) => {
  const projectId = c.req.param('projectId') as string;
  const result = await db.select().from(equipment).where(eq(equipment.currentProjectId, projectId));
  return c.json(result);
});
