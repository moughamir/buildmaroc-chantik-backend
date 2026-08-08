import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { hotspots } from '../db/schema';
import { eq, gt } from 'drizzle-orm';
import { syncBatchSchema, syncPullResponseSchema, syncBatchResponseSchema } from '../validation/schemas';
import type { SyncBatchInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

// Mounted at /api/v1/sync.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const syncApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const syncPullRoute = createRoute({
  method: 'get',
  path: '/pull',
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

  const updatedHotspots = await db.select()
    .from(hotspots)
    .where(gt(hotspots.updatedAt, lastSync));

  return c.json({
    timestamp: new Date().toISOString(),
    changes: { hotspots: updatedHotspots },
  });
});

const syncBatchRoute = createRoute({
  method: 'post',
  path: '/batch',
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
