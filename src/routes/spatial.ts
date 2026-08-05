import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import {
  zones,
  capturePoints,
  panoramas,
  hotspots,
} from '../db/schema';
import {
  validateZoneCreate,
  validateCapturePointCreate,
  validatePanoramaUpload,
  validateCreateHotspot,
  validateUpdateHotspotStatus,
} from '../validation/middleware';
import type { ZoneCreateInput, CapturePointCreateInput, PanoramaUploadInput } from '../validation/schemas';

export const spatialRouter = new Hono();

spatialRouter.get('/zones/:zoneId/capture-points', async (c) => {
  const zoneId = c.req.param('zoneId');
  const result = await db.select().from(capturePoints).where(eq(capturePoints.zoneId, zoneId)).all();
  return c.json(result);
});

spatialRouter.post('/zones/:zoneId/capture-points', validateCapturePointCreate, async (c) => {
  const zoneId = c.req.param('zoneId');
  const input = c.req.valid('json') as CapturePointCreateInput;
  const [cp] = await db.insert(capturePoints).values({
    zoneId,
    title: input.title,
    coordinates: input.coordinates,
  }).returning();

  return c.json(cp, 201);
});

spatialRouter.post('/capture-points/:cpId/panoramas', validatePanoramaUpload, async (c) => {
  const cpId = c.req.param('cpId');
  const input = c.req.valid('json') as PanoramaUploadInput;
  const [panorama] = await db.insert(panoramas).values({
    capturePointId: cpId,
    storagePath: input.storagePath,
    capturedAt: new Date(input.capturedAt),
    uploadedById: input.uploadedById,
    metadata: input.metadata,
  }).returning();

  return c.json(panorama, 201);
});

spatialRouter.get('/panoramas/:panoramaId/hotspots', async (c) => {
  const panoramaId = c.req.param('panoramaId');
  const result = await db.select().from(hotspots).where(eq(hotspots.panoramaId, panoramaId)).all();
  return c.json(result);
});

spatialRouter.post('/panoramas/:panoramaId/hotspots', validateCreateHotspot, async (c) => {
  const panoramaId = c.req.param('panoramaId');
  const input = c.req.valid('json');
  const [hotspot] = await db.insert(hotspots).values({
    panoramaId,
    createdById: input.createdById,
    pitch: input.pitch,
    yaw: input.yaw,
    title: input.title,
    description: input.description,
    status: input.status || 'pending',
  }).returning();

  return c.json(hotspot, 201);
});

spatialRouter.patch('/hotspots/:hotspotId', validateUpdateHotspotStatus, async (c) => {
  const hotspotId = c.req.param('hotspotId');
  const input = c.req.valid('json');
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) updates.status = input.status;

  const [hotspot] = await db.update(hotspots)
    .set(updates)
    .where(eq(hotspots.id, hotspotId))
    .returning();

  if (!hotspot) return c.json({ error: 'Hotspot not found' }, 404);
  return c.json(hotspot);
});