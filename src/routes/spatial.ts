import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import {
  capturePoints,
  panoramas,
  hotspots,
} from '../db/schema';
import {
  validateZoneCreate,
  validateCapturePointCreate,
  validatePanoramaUpload,
  validateCreateHotspotRest,
  validateUpdateHotspotRest,
} from '../validation/middleware';
import type {
  ZoneCreateInput,
  CapturePointCreateInput,
  PanoramaUploadInput,
  CreateHotspotRestInput,
  UpdateHotspotRestInput,
} from '../validation/schemas';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

export const spatialRouter = new Hono();

spatialRouter.get('/zones/:zoneId/capture-points', async (c) => {
  const zoneId = c.req.param('zoneId');
  const result = await db.select().from(capturePoints).where(eq(capturePoints.zoneId, zoneId));
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

spatialRouter.get('/capture-points/:cpId/panoramas', async (c) => {
  const cpId = c.req.param('cpId');
  const result = await db.select().from(panoramas)
    .where(eq(panoramas.capturePointId, cpId))
    .orderBy(panoramas.capturedAt);
  return c.json(result);
});

spatialRouter.get('/panoramas/:panoramaId/asset', async (c) => {
  const panoramaId = c.req.param('panoramaId');
  const [panorama] = await db.select().from(panoramas).where(eq(panoramas.id, panoramaId)).limit(1);
  if (!panorama) return c.json({ error: 'Panorama not found' }, 404);

  if (!supabase) return c.json({ error: 'Storage not configured' }, 500);

  const { data, error } = await supabase.storage
    .from('chantik-assets')
    .createSignedUrl(panorama.storagePath, 3600);

  if (error) return c.json({ error: error.message }, 400);

  return c.redirect(data.signedUrl);
});

spatialRouter.get('/panoramas/:panoramaId/hotspots', async (c) => {
  const panoramaId = c.req.param('panoramaId');
  const result = await db.select().from(hotspots).where(eq(hotspots.panoramaId, panoramaId));
  return c.json(result);
});

spatialRouter.post('/panoramas/:panoramaId/hotspots', validateCreateHotspotRest, async (c) => {
  const panoramaId = c.req.param('panoramaId');
  const input = c.req.valid('json') as CreateHotspotRestInput;
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

spatialRouter.patch('/hotspots/:hotspotId', validateUpdateHotspotRest, async (c) => {
  const hotspotId = c.req.param('hotspotId');
  const input = c.req.valid('json') as UpdateHotspotRestInput;
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