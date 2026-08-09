import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import {
  capturePoints,
  panoramas,
  hotspots,
} from '../db/schema';
import {
  capturePointCreateSchema,
  panoramaUploadSchema,
  createHotspotRestSchema,
  updateHotspotRestSchema,
  capturePointSelectSchema,
  panoramaSelectSchema,
  hotspotSelectSchema,
} from '../validation/schemas';
import type {
  CapturePointCreateInput,
  PanoramaUploadInput,
  CreateHotspotRestInput,
  UpdateHotspotRestInput,
} from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

// Mounted at /api/v1.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const spatialApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const zoneCapturePointsListRoute = createRoute({
  method: 'get',
  path: '/zones/{zoneId}/capture-points',
  tags: ['spatial'],
  request: { params: z.object({ zoneId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Capture points for a zone',
      content: { 'application/json': { schema: z.array(capturePointSelectSchema) } },
    },
  },
});

spatialApp.openapi(zoneCapturePointsListRoute, async (c) => {
  const zoneId = c.req.param('zoneId');
  const result = await db.select().from(capturePoints).where(eq(capturePoints.zoneId, zoneId));
  return c.json(result);
});

const zoneCapturePointsCreateRoute = createRoute({
  method: 'post',
  path: '/zones/{zoneId}/capture-points',
  tags: ['spatial'],
  request: {
    params: z.object({ zoneId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: capturePointCreateSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Capture point created',
      content: { 'application/json': { schema: capturePointSelectSchema } },
    },
  },
});

spatialApp.openapi(zoneCapturePointsCreateRoute, async (c) => {
  const zoneId = c.req.param('zoneId');
  const input = c.req.valid('json') as CapturePointCreateInput;
  const [cp] = await db.insert(capturePoints).values({
    zoneId,
    title: input.title,
    coordinates: input.coordinates,
  }).returning();

  return c.json(cp, 201);
});

const panoramaCreateRoute = createRoute({
  method: 'post',
  path: '/capture-points/{cpId}/panoramas',
  tags: ['spatial'],
  request: {
    params: z.object({ cpId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: panoramaUploadSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Panorama registered',
      content: { 'application/json': { schema: panoramaSelectSchema } },
    },
  },
});

spatialApp.openapi(panoramaCreateRoute, async (c) => {
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

const panoramaListRoute = createRoute({
  method: 'get',
  path: '/capture-points/{cpId}/panoramas',
  tags: ['spatial'],
  request: { params: z.object({ cpId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Panoramas for a capture point',
      content: { 'application/json': { schema: z.array(panoramaSelectSchema) } },
    },
  },
});

spatialApp.openapi(panoramaListRoute, async (c) => {
  const cpId = c.req.param('cpId');
  const result = await db.select().from(panoramas)
    .where(eq(panoramas.capturePointId, cpId))
    .orderBy(panoramas.capturedAt);
  return c.json(result);
});

const panoramaAssetRoute = createRoute({
  method: 'get',
  path: '/panoramas/{panoramaId}/asset',
  tags: ['spatial'],
  request: { params: z.object({ panoramaId: z.string().uuid() }) },
  responses: {
    302: {
      description: 'Redirect to the signed asset URL',
    },
    400: {
      description: 'Supabase storage error',
    },
    404: {
      description: 'Panorama not found',
    },
    500: {
      description: 'Storage not configured',
    },
  },
});

spatialApp.openapi(panoramaAssetRoute, async (c) => {
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

const hotspotListRoute = createRoute({
  method: 'get',
  path: '/panoramas/{panoramaId}/hotspots',
  tags: ['spatial'],
  request: { params: z.object({ panoramaId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Hotspots for a panorama',
      content: { 'application/json': { schema: z.array(hotspotSelectSchema) } },
    },
  },
});

spatialApp.openapi(hotspotListRoute, async (c) => {
  const panoramaId = c.req.param('panoramaId');
  const result = await db.select().from(hotspots).where(eq(hotspots.panoramaId, panoramaId));
  return c.json(result);
});

const hotspotCreateRoute = createRoute({
  method: 'post',
  path: '/panoramas/{panoramaId}/hotspots',
  tags: ['spatial'],
  request: {
    params: z.object({ panoramaId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: createHotspotRestSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Hotspot created',
      content: { 'application/json': { schema: hotspotSelectSchema } },
    },
  },
});

spatialApp.openapi(hotspotCreateRoute, async (c) => {
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

const hotspotPatchRoute = createRoute({
  method: 'patch',
  path: '/hotspots/{hotspotId}',
  tags: ['spatial'],
  request: {
    params: z.object({ hotspotId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateHotspotRestSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Hotspot updated',
      content: { 'application/json': { schema: hotspotSelectSchema } },
    },
    404: {
      description: 'Hotspot not found',
    },
  },
});

spatialApp.openapi(hotspotPatchRoute, async (c) => {
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
