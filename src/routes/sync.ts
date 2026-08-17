import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { hotspots, panoramas, capturePoints, zones, projects } from '../db/schema';
import { and, eq, getTableColumns, gt } from 'drizzle-orm';
import { syncBatchSchema, syncPullResponseSchema, syncBatchResponseSchema } from '../validation/schemas';
import type { SyncBatchInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';
import { requirePanoramaInOrg, requireHotspotInOrg } from '../middleware/tenant';

// Mounted at /api/v1/sync.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const syncApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const syncPullRoute = createRoute({
  method: 'get',
  path: '/pull',
  tags: ['sync'],
  request: {
    query: z.object({ since: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'Incremental changes since the given timestamp',
      content: { 'application/json': { schema: syncPullResponseSchema } },
    },
  },
});

syncApp.openapi(syncPullRoute, async (c) => {
  const since = c.req.query('since');
  const lastSync = since ? new Date(since) : new Date(0);

  // S6: scope the pull to the caller's org — only hotspots whose ownership
  // chain reaches the caller's organization (hotspots → panoramas → capture
  // points → zones → projects.organizationId). Empty list when no org resolves
  // (e.g. dev-bypass user with no membership), matching the list convention.
  const orgId = c.get('orgId');
  if (!orgId) {
    return c.json({
      timestamp: new Date().toISOString(),
      changes: { hotspots: [] },
    });
  }

  const updatedHotspots = await db
    .select({ ...getTableColumns(hotspots) })
    .from(hotspots)
    .innerJoin(panoramas, eq(panoramas.id, hotspots.panoramaId))
    .innerJoin(capturePoints, eq(capturePoints.id, panoramas.capturePointId))
    .innerJoin(zones, eq(zones.id, capturePoints.zoneId))
    .innerJoin(projects, eq(projects.id, zones.projectId))
    .where(and(
      gt(hotspots.updatedAt, lastSync),
      eq(projects.organizationId, orgId),
    ));

  return c.json({
    timestamp: new Date().toISOString(),
    changes: { hotspots: updatedHotspots },
  });
});

const syncBatchRoute = createRoute({
  method: 'post',
  path: '/batch',
  tags: ['sync'],
  request: {
    body: { content: { 'application/json': { schema: syncBatchSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Processed offline mutations',
      content: { 'application/json': { schema: syncBatchResponseSchema } },
    },
  },
});

syncApp.openapi(syncBatchRoute, async (c) => {
  const { mutations } = c.req.valid('json') as SyncBatchInput;

  // S6: every mutation must target a resource within the caller's org before
  // any write happens — CREATE_HOTSPOT via its panorama, UPDATE_HOTSPOT_STATUS
  // via the hotspot itself (both resolved through the ownership chain).
  // Passes through under dev bypass.
  for (const action of mutations) {
    const denied = action.type === 'CREATE_HOTSPOT'
      ? await requirePanoramaInOrg(c, action.payload.panoramaId)
      : await requireHotspotInOrg(c, action.payload.id);
    if (denied) return denied;
  }

  const results: { clientGuid: string; status: 'synced'; data: typeof hotspots.$inferSelect }[] = [];
  for (const action of mutations) {
    if (action.type === 'CREATE_HOTSPOT') {
      const inserted = await db.insert(hotspots).values(action.payload).returning();
      results.push({ clientGuid: action.guid, status: 'synced', data: inserted[0] });
    } else if (action.type === 'UPDATE_HOTSPOT_STATUS') {
      const updated = await db.update(hotspots)
        .set({ status: action.payload.status, updatedAt: new Date() })
        .where(eq(hotspots.id, action.payload.id))
        .returning();
      results.push({ clientGuid: action.guid, status: 'synced', data: updated[0] });
    }
  }

  return c.json({ processed: results });
});
