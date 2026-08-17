import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { rfis, changeOrders } from '../db/schema';
import {
  rfiUpdateSchema,
  changeOrderUpdateSchema,
  rfiSelectSchema,
  changeOrderSelectSchema,
} from '../validation/schemas';
import type { RfiUpdateInput, ChangeOrderUpdateInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';
import { requireRfiInOrg, requireChangeOrderInOrg } from '../middleware/tenant';

// Mounted at /api/v1/construction.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const constructionApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const rfiPatchRoute = createRoute({
  method: 'patch',
  path: '/rfis/{rfiId}',
  tags: ['construction'],
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

constructionApp.openapi(rfiPatchRoute, async (c) => {
  const rfiId = c.req.param('rfiId');
  const denied = await requireRfiInOrg(c, rfiId);
  if (denied) return denied;
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
  tags: ['construction'],
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

constructionApp.openapi(changeOrderPatchRoute, async (c) => {
  const coId = c.req.param('coId');
  const denied = await requireChangeOrderInOrg(c, coId);
  if (denied) return denied;
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
