import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq, desc, inArray } from 'drizzle-orm';
import {
  projects,
  zones,
  capturePoints,
  panoramas,
  hotspots,
  projectHealthView,
  rfis,
  changeOrders,
  blueprintSheets,
  attendanceLogs,
  siteDailyLogs,
  organizationMembers,
} from '../db/schema';
import {
  projectSchema,
  zoneCreateSchema,
  rfiSchema,
  changeOrderSchema,
  blueprintSheetSchema,
  siteDailyLogSchema,
  projectSelectSchema,
  zoneSelectSchema,
  rfiSelectSchema,
  changeOrderSelectSchema,
  blueprintSheetSelectSchema,
  siteDailyLogSelectSchema,
  attendanceLogSelectSchema,
  projectHealthSelectSchema,
  projectWithCapturesSchema,
} from '../validation/schemas';
import type { ProjectInput, ZoneCreateInput, RfiInput, ChangeOrderInput, BlueprintSheetInput, SiteDailyLogInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';
import { requireProjectInOrg } from '../middleware/tenant';

const projectIdParam = { projectId: z.string().uuid() };

// L6c: shared 400 validation shape { error: { message, issues } } for invalid
// bodies / params / query (defaultHook) and malformed JSON (onError).
export const projectsApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const listProjectsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['projects'],
  responses: {
    200: {
      description: 'List the authenticated user\'s default-org projects',
      content: { 'application/json': { schema: z.array(projectSelectSchema) } },
    },
    401: {
      description: 'Authentication required',
    },
  },
});

// [0.1] GET / — the frontend calls GET /api/v1/projects with no orgId.
// Org resolution: session context orgId (set by sessionMiddleware from the
// better-auth active organization), falling back to the user's first
// organization membership when the session carries none. The legacy `?orgId=`
// query override was removed (S6) — it let any caller read any org's projects.
projectsApp.openapi(listProjectsRoute, async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  let orgId = c.get('orgId');

  if (!orgId) {
    // Fallback: user's first organization membership (default org).
    const [member] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);
    orgId = member?.organizationId ?? null;
  }

  if (!orgId) {
    // No resolvable org (e.g. dev-bypass user with no membership) — return an
    // empty list rather than 404/400, so list consumers (e.g. frontend
    // store.init) don't treat this as a failure.
    return c.json([]);
  }

  const result = await db.select().from(projects).where(eq(projects.organizationId, orgId));
  return c.json(result);
});

const projectGetRoute = createRoute({
  method: 'get',
  path: '/{projectId}',
  tags: ['projects'],
  request: { params: z.object(projectIdParam) },
  responses: {
    200: {
      description: 'Project with nested captures',
      content: { 'application/json': { schema: projectWithCapturesSchema } },
    },
    404: {
      description: 'Project not found',
    },
  },
});

projectsApp.openapi(projectGetRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  // [0.3] Wire captures: project → zones → capturePoints → panoramas → hotspots.
  // A "capture" is the set of panoramas sharing a capturedAt timestamp (the seed
  // creates one panorama per zone per capture); each capture carries the zones it
  // was shot from and all its hotspots so the frontend 360° viewer renders with
  // no extra spatial calls. Display fields (week/progress/operator/note) are read
  // from the panoramas' `metadata` jsonb — DB-native, seeded per capture.
  const zoneRows = await db.select().from(zones).where(eq(zones.projectId, project.id));
  const captures = await assembleCaptures(zoneRows);

  return c.json({ ...project, captures });
});

/**
 * [0.3] Assemble the nested `captures` array for a project from its spatial
 * hierarchy (zones → capture_points → panoramas → hotspots), grouped into
 * captures by the shared `capturedAt` timestamp. Batched selects (no N+1);
 * drizzle relational queries (`db.query`) are not available here because the
 * schema tables define no `relations`.
 */
async function assembleCaptures(zoneRows: (typeof zones.$inferSelect)[]): Promise<unknown[]> {
  if (zoneRows.length === 0) return [];

  const cpRows = await db.select().from(capturePoints)
    .where(inArray(capturePoints.zoneId, zoneRows.map((z) => z.id)));
  if (cpRows.length === 0) return [];

  const panoRows = await db.select().from(panoramas)
    .where(inArray(panoramas.capturePointId, cpRows.map((cp) => cp.id)));
  if (panoRows.length === 0) return [];

  const hotspotRows = await db.select().from(hotspots)
    .where(inArray(hotspots.panoramaId, panoRows.map((p) => p.id)));

  const zoneById = new Map(zoneRows.map((z) => [z.id, z]));
  const cpById = new Map(cpRows.map((cp) => [cp.id, cp]));
  const hotspotsByPanoramaId = new Map<string, (typeof hotspots.$inferSelect)[]>();
  for (const hotspot of hotspotRows) {
    const list = hotspotsByPanoramaId.get(hotspot.panoramaId) ?? [];
    list.push(hotspot);
    hotspotsByPanoramaId.set(hotspot.panoramaId, list);
  }

  // Group panoramas by capture timestamp (all zones of one capture share it).
  const groups = new Map<string, (typeof panoramas.$inferSelect)[]>();
  for (const pano of panoRows) {
    const key = pano.capturedAt.toISOString();
    const list = groups.get(key) ?? [];
    list.push(pano);
    groups.set(key, list);
  }

  const zoneOf = (pano: (typeof panoramas.$inferSelect)) =>
    zoneById.get(cpById.get(pano.capturePointId)!.zoneId)!;

  const captures: unknown[] = [];
  for (const [, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...group].sort((a, b) => zoneOf(a).name.localeCompare(zoneOf(b).name));
    const first = sorted[0];
    const meta = (first.metadata ?? {}) as Record<string, unknown>;

    captures.push({
      id: first.id,
      capturedAt: first.capturedAt.toISOString(),
      date: first.capturedAt.toISOString(),
      ...meta,
      zones: sorted.map(zoneOf),
      hotspots: sorted.flatMap((p) => hotspotsByPanoramaId.get(p.id) ?? []),
    });
  }
  return captures;
}

const projectPatchRoute = createRoute({
  method: 'patch',
  path: '/{projectId}',
  tags: ['projects'],
  request: {
    params: z.object(projectIdParam),
    body: { content: { 'application/json': { schema: projectSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Project updated',
      content: { 'application/json': { schema: projectSelectSchema } },
    },
    404: {
      description: 'Project not found',
    },
  },
});

projectsApp.openapi(projectPatchRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
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

const projectHealthRoute = createRoute({
  method: 'get',
  path: '/{projectId}/health',
  tags: ['projects'],
  request: { params: z.object(projectIdParam) },
  responses: {
    200: {
      description: 'Project health summary',
      content: { 'application/json': { schema: projectHealthSelectSchema } },
    },
    404: {
      description: 'Project not found',
    },
  },
});

projectsApp.openapi(projectHealthRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const [health] = await db.select().from(projectHealthView).where(eq(projectHealthView.projectId, projectId)).limit(1);
  if (!health) return c.json({ error: 'Project not found' }, 404);
  return c.json(health);
});

const projectZonesListRoute = createRoute({
  method: 'get',
  path: '/{projectId}/zones',
  tags: ['projects'],
  request: { params: z.object(projectIdParam) },
  responses: {
    200: {
      description: 'List project zones',
      content: { 'application/json': { schema: z.array(zoneSelectSchema) } },
    },
  },
});

projectsApp.openapi(projectZonesListRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const result = await db.select().from(zones).where(eq(zones.projectId, projectId));
  return c.json(result);
});

const projectZonesCreateRoute = createRoute({
  method: 'post',
  path: '/{projectId}/zones',
  tags: ['projects'],
  request: {
    params: z.object(projectIdParam),
    body: { content: { 'application/json': { schema: zoneCreateSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Zone created',
      content: { 'application/json': { schema: zoneSelectSchema } },
    },
  },
});

projectsApp.openapi(projectZonesCreateRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const input = c.req.valid('json') as ZoneCreateInput;
  const [zone] = await db.insert(zones).values({
    projectId,
    name: input.name,
    level: input.level,
  }).returning();

  return c.json(zone, 201);
});

const projectAttendanceRoute = createRoute({
  method: 'get',
  path: '/{projectId}/attendance',
  tags: ['projects'],
  request: { params: z.object(projectIdParam) },
  responses: {
    200: {
      description: 'List project attendance logs',
      content: { 'application/json': { schema: z.array(attendanceLogSelectSchema) } },
    },
  },
});

projectsApp.openapi(projectAttendanceRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
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

const projectDailyLogsListRoute = createRoute({
  method: 'get',
  path: '/{projectId}/daily-logs',
  tags: ['projects'],
  request: { params: z.object(projectIdParam) },
  responses: {
    200: {
      description: 'List project daily logs',
      content: { 'application/json': { schema: z.array(siteDailyLogSelectSchema) } },
    },
  },
});

projectsApp.openapi(projectDailyLogsListRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const result = await db.select().from(siteDailyLogs).where(eq(siteDailyLogs.projectId, projectId));
  return c.json(result);
});

const projectDailyLogsCreateRoute = createRoute({
  method: 'post',
  path: '/{projectId}/daily-logs',
  tags: ['projects'],
  request: {
    params: z.object(projectIdParam),
    body: { content: { 'application/json': { schema: siteDailyLogSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Daily log created',
      content: { 'application/json': { schema: siteDailyLogSelectSchema } },
    },
  },
});

projectsApp.openapi(projectDailyLogsCreateRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
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

const projectRfisListRoute = createRoute({
  method: 'get',
  path: '/{projectId}/rfis',
  tags: ['projects'],
  request: { params: z.object(projectIdParam) },
  responses: {
    200: {
      description: 'List project RFIs',
      content: { 'application/json': { schema: z.array(rfiSelectSchema) } },
    },
  },
});

projectsApp.openapi(projectRfisListRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const result = await db.select().from(rfis).where(eq(rfis.projectId, projectId));
  return c.json(result);
});

const projectRfisCreateRoute = createRoute({
  method: 'post',
  path: '/{projectId}/rfis',
  tags: ['projects'],
  request: {
    params: z.object(projectIdParam),
    body: { content: { 'application/json': { schema: rfiSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'RFI created',
      content: { 'application/json': { schema: rfiSelectSchema } },
    },
  },
});

projectsApp.openapi(projectRfisCreateRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
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

const projectChangeOrdersListRoute = createRoute({
  method: 'get',
  path: '/{projectId}/change-orders',
  tags: ['projects'],
  request: { params: z.object(projectIdParam) },
  responses: {
    200: {
      description: 'List project change orders',
      content: { 'application/json': { schema: z.array(changeOrderSelectSchema) } },
    },
  },
});

projectsApp.openapi(projectChangeOrdersListRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const result = await db.select().from(changeOrders).where(eq(changeOrders.projectId, projectId));
  return c.json(result);
});

const projectChangeOrdersCreateRoute = createRoute({
  method: 'post',
  path: '/{projectId}/change-orders',
  tags: ['projects'],
  request: {
    params: z.object(projectIdParam),
    body: { content: { 'application/json': { schema: changeOrderSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Change order created',
      content: { 'application/json': { schema: changeOrderSelectSchema } },
    },
  },
});

projectsApp.openapi(projectChangeOrdersCreateRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
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

const projectBlueprintsListRoute = createRoute({
  method: 'get',
  path: '/{projectId}/blueprints',
  tags: ['projects'],
  request: { params: z.object(projectIdParam) },
  responses: {
    200: {
      description: 'List project blueprint sheets',
      content: { 'application/json': { schema: z.array(blueprintSheetSelectSchema) } },
    },
  },
});

projectsApp.openapi(projectBlueprintsListRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
  const result = await db.select().from(blueprintSheets).where(eq(blueprintSheets.projectId, projectId));
  return c.json(result);
});

const projectBlueprintsCreateRoute = createRoute({
  method: 'post',
  path: '/{projectId}/blueprints',
  tags: ['projects'],
  request: {
    params: z.object(projectIdParam),
    body: { content: { 'application/json': { schema: blueprintSheetSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Blueprint sheet created',
      content: { 'application/json': { schema: blueprintSheetSelectSchema } },
    },
  },
});

projectsApp.openapi(projectBlueprintsCreateRoute, async (c) => {
  const projectId = c.req.param('projectId');
  const denied = await requireProjectInOrg(c, projectId);
  if (denied) return denied;
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
