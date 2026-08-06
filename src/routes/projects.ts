import { Hono } from 'hono';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import {
  projects,
  zones,
  projectHealthView,
  rfis,
  changeOrders,
  blueprintSheets,
  attendanceLogs,
  siteDailyLogs,
  organizationMembers,
} from '../db/schema';
import { validateProject, validateZoneCreate, validateRfi, validateChangeOrder, validateBlueprintSheet, validateSiteDailyLog } from '../validation/middleware';
import type { ProjectInput, ZoneCreateInput, RfiInput, ChangeOrderInput, BlueprintSheetInput, SiteDailyLogInput } from '../validation/schemas';

export const projectsRouter = new Hono();

// [0.1] Alias GET / — the frontend calls GET /api/v1/projects with no orgId.
// The org is resolved from the authenticated user's organization membership,
// and an explicit `?orgId=` query param is honored when present (backwards-compatible).
projectsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const orgId = c.req.query('orgId');

  if (orgId) {
    // Caller passed an explicit orgId — return that org's projects directly.
    const result = await db.select().from(projects).where(eq(projects.organizationId, orgId));
    return c.json(result);
  }

  // Look up the user's first organization membership (default org)
  const [member] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  if (!member) {
    // No org membership — return an empty list rather than 404/400,
    // so list consumers (e.g. frontend store.init) don't treat this as a failure.
    return c.json([]);
  }

  const result = await db.select().from(projects).where(eq(projects.organizationId, member.organizationId));
  return c.json(result);
});

projectsRouter.get('/:orgId/projects', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(projects).where(eq(projects.organizationId, orgId));
  return c.json(result);
});

projectsRouter.post('/:orgId/projects', validateProject, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as ProjectInput;
  const [project] = await db.insert(projects).values({
    organizationId: orgId,
    name: input.name,
    code: input.code,
    region: input.region,
    coordinates: input.coordinates,
    status: input.status || 'planning',
  }).returning();

  return c.json(project, 201);
});

projectsRouter.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json(project);
});

projectsRouter.patch('/:projectId', validateProject, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as ProjectInput;
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.code !== undefined) updates.code = input.code;
  if (input.region !== undefined) updates.region = input.region;
  if (input.coordinates !== undefined) updates.coordinates = input.coordinates;
  if (input.status !== undefined) updates.status = input.status;

  const [project] = await db.update(projects)
    .set(updates)
    .where(eq(projects.id, projectId))
    .returning();

  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json(project);
});

projectsRouter.get('/:projectId/health', async (c) => {
  const projectId = c.req.param('projectId');
  const [health] = await db.select().from(projectHealthView).where(eq(projectHealthView.projectId, projectId)).limit(1);
  if (!health) return c.json({ error: 'Project not found' }, 404);
  return c.json(health);
});

projectsRouter.get('/:projectId/zones', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(zones).where(eq(zones.projectId, projectId));
  return c.json(result);
});

projectsRouter.post('/:projectId/zones', validateZoneCreate, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as ZoneCreateInput;
  const [zone] = await db.insert(zones).values({
    projectId,
    name: input.name,
    level: input.level,
  }).returning();

  return c.json(zone, 201);
});

projectsRouter.get('/:projectId/attendance', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db
    .select({
      id: attendanceLogs.id,
      userId: attendanceLogs.userId,
      clockInAt: attendanceLogs.clockInAt,
      clockOutAt: attendanceLogs.clockOutAt,
      totalHours: attendanceLogs.totalHours,
      isFlagged: attendanceLogs.isFlagged,
      flagReason: attendanceLogs.flagReason,
      status: attendanceLogs.status,
    })
    .from(attendanceLogs)
    .where(eq(attendanceLogs.projectId, projectId));

  return c.json(result);
});

projectsRouter.get('/:projectId/daily-logs', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(siteDailyLogs).where(eq(siteDailyLogs.projectId, projectId));
  return c.json(result);
});

projectsRouter.post('/:projectId/daily-logs', validateSiteDailyLog, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as SiteDailyLogInput;
  const [log] = await db.insert(siteDailyLogs).values({
    projectId,
    submittedById: input.submittedById,
    logDate: new Date(input.logDate),
    weatherConditions: input.weatherConditions,
    workSummary: input.workSummary,
    safetyIncidentsReported: input.safetyIncidentsReported || false,
    incidentDetails: input.incidentDetails,
  }).returning();

  return c.json(log, 201);
});

projectsRouter.get('/:projectId/rfis', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(rfis).where(eq(rfis.projectId, projectId));
  return c.json(result);
});

projectsRouter.post('/:projectId/rfis', validateRfi, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as RfiInput;
  const [maxRfi] = await db.select({ maxNum: rfis.rfiNumber }).from(rfis).where(eq(rfis.projectId, projectId)).orderBy(desc(rfis.rfiNumber)).limit(1);
  const nextNumber = maxRfi ? maxRfi.maxNum + 1 : 1;

  const [rfi] = await db.insert(rfis).values({
    projectId,
    rfiNumber: nextNumber,
    title: input.title,
    question: input.question,
    answer: input.answer,
    status: input.status || 'draft',
    createdById: input.createdById,
    assignedToId: input.assignedToId,
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
  }).returning();

  return c.json(rfi, 201);
});

projectsRouter.get('/:projectId/change-orders', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(changeOrders).where(eq(changeOrders.projectId, projectId));
  return c.json(result);
});

projectsRouter.post('/:projectId/change-orders', validateChangeOrder, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as ChangeOrderInput;
  const [co] = await db.insert(changeOrders).values({
    projectId,
    coNumber: input.coNumber,
    title: input.title,
    description: input.description,
    costImpactCents: input.costImpactCents,
    scheduleImpactDays: input.scheduleImpactDays,
    status: input.status || 'pending',
    requestedById: input.requestedById,
    approvedById: input.approvedById,
  }).returning();

  return c.json(co, 201);
});

projectsRouter.get('/:projectId/blueprints', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(blueprintSheets).where(eq(blueprintSheets.projectId, projectId));
  return c.json(result);
});

projectsRouter.post('/:projectId/blueprints', validateBlueprintSheet, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as BlueprintSheetInput;
  const [sheet] = await db.insert(blueprintSheets).values({
    projectId,
    sheetNumber: input.sheetNumber,
    title: input.title,
    version: input.version,
    storagePath: input.storagePath,
    uploadedById: input.uploadedById,
  }).returning();

  return c.json(sheet, 201);
});