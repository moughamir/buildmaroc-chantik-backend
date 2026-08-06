import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { workCrews, crewMembers, siteDailyLogs } from '../db/schema';

export const workforceRouter = new Hono();

workforceRouter.get('/organizations/:orgId/crews', async (c) => {
  const orgId = c.req.param('orgId') as string;
  const result = await db.select().from(workCrews).where(eq(workCrews.organizationId, orgId));
  return c.json(result);
});

workforceRouter.post('/organizations/:orgId/crews', async (c) => {
  const orgId = c.req.param('orgId') as string;
  const body = await c.req.json<any>();
  const [crew] = await db.insert(workCrews).values({
    organizationId: orgId,
    name: body.name,
    trade: body.trade,
    projectId: body.projectId || null,
  } as any).returning();
  return c.json(crew, 201);
});

workforceRouter.get('/projects/:projectId/daily-logs', async (c) => {
  const projectId = c.req.param('projectId') as string;
  const result = await db.select().from(siteDailyLogs).where(eq(siteDailyLogs.projectId, projectId));
  return c.json(result);
});

workforceRouter.post('/projects/:projectId/daily-logs', async (c) => {
  const projectId = c.req.param('projectId') as string;
  const userId = ((c as any).get('userId') as string) || '';
  const body = await c.req.json<any>();
  const [log] = await db.insert(siteDailyLogs).values({
    projectId,
    submittedById: userId,
    logDate: body.logDate ? new Date(body.logDate) : new Date(),
    weatherConditions: body.weatherConditions,
    workSummary: body.workSummary,
    safetyIncidentsReported: body.safetyIncidentsReported || false,
    incidentDetails: body.incidentDetails,
  } as any).returning();
  return c.json(log, 201);
});
