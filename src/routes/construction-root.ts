import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { rfis, changeOrders, equipment } from '../db/schema';
import {
  rfiUpdateSchema,
  changeOrderUpdateSchema,
  equipmentUpdateSchema,
  rfiSelectSchema,
  changeOrderSelectSchema,
  equipmentSelectSchema,
} from '../validation/schemas';
import type { RfiUpdateInput, ChangeOrderUpdateInput, EquipmentUpdateInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

// Mounted at /api/v1.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const constructionRootApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const rfiPatchRoute = createRoute({
  method: 'patch',
  path: '/rfis/{rfiId}',
  request: {
    params: z.object({ rfiId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: rfiUpdateSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'RFI updated',
      content: { 'application/json': { schema: rfiSelectSchema } },
    },
    404: {
      description: 'RFI not found',
    },
  },
});

constructionRootApp.openapi(rfiPatchRoute, async (c) => {
  const rfiId = c.req.param('rfiId');
  const input = c.req.valid('json') as RfiUpdateInput;
  const updates: Record<string, unknown> = {};
  if (input.answer !== undefined) updates.answer = input.answer;
  if (input.status !== undefined) updates.status = input.status;
  if (input.assignedToId !== undefined) updates.assignedToId = input.assignedToId;

  const [rfi] = await db.update(rfis)
    .set(updates)
    .where(eq(rfis.id, rfiId))
    .returning();

  if (!rfi) return c.json({ error: 'RFI not found' }, 404);
  return c.json(rfi);
});

const changeOrderPatchRoute = createRoute({
  method: 'patch',
  path: '/change-orders/{coId}',
  request: {
    params: z.object({ coId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: changeOrderUpdateSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Change order updated',
      content: { 'application/json': { schema: changeOrderSelectSchema } },
    },
    404: {
      description: 'Change order not found',
    },
  },
});

constructionRootApp.openapi(changeOrderPatchRoute, async (c) => {
  const coId = c.req.param('coId');
  const input = c.req.valid('json') as ChangeOrderUpdateInput;
  const updates: Record<string, unknown> = { status: input.status };
  if (input.approvedById !== undefined) updates.approvedById = input.approvedById;

  const [co] = await db.update(changeOrders)
    .set(updates)
    .where(eq(changeOrders.id, coId))
    .returning();

  if (!co) return c.json({ error: 'Change order not found' }, 404);
  return c.json(co);
});

const equipmentPatchRoute = createRoute({
  method: 'patch',
  path: '/equipment/{eqId}',
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

constructionRootApp.openapi(equipmentPatchRoute, async (c) => {
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
