import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { equipment } from '../db/schema';
import { equipmentUpdateSchema, equipmentSelectSchema } from '../validation/schemas';
import type { EquipmentUpdateInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

// Mounted at /api/v1/equipment.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const equipmentApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const equipmentPatchRoute = createRoute({
  method: 'patch',
  path: '/{eqId}',
  tags: ['equipment'],
  request: {
    params: z.object({ eqId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: equipmentUpdateSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Equipment updated',
      content: { 'application/json': { schema: equipmentSelectSchema } },
    },
    404: {
      description: 'Equipment not found',
    },
  },
});

equipmentApp.openapi(equipmentPatchRoute, async (c) => {
  const eqId = c.req.param('eqId');
  const input = c.req.valid('json') as EquipmentUpdateInput;
  const updates: Record<string, unknown> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.currentProjectId !== undefined) updates.currentProjectId = input.currentProjectId;
  if (input.lastServiceDate !== undefined) updates.lastServiceDate = new Date(input.lastServiceDate);

  const [updatedEq] = await db.update(equipment)
    .set(updates)
    .where(eq(equipment.id, eqId))
    .returning();

  if (!updatedEq) return c.json({ error: 'Equipment not found' }, 404);
  return c.json(updatedEq);
});
