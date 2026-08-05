import { Hono } from 'hono';
import { db } from '../db';
import { hotspots } from '../db/schema';
import { eq, gt } from 'drizzle-orm';
import { validateSyncBatch } from '../validation/middleware';
import type { SyncBatchInput } from '../validation/schemas';

export const syncRouter = new Hono();

syncRouter.get('/pull', async (c) => {
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

syncRouter.post('/batch', validateSyncBatch, async (c) => {
  const { mutations } = c.req.valid('json') as SyncBatchInput;

  const results = [];
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