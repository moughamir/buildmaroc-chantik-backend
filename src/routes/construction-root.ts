import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { rfis, changeOrders, equipment } from '../db/schema';
import {
  validateRfiUpdate,
  validateChangeOrderUpdate,
  validateEquipmentUpdate,
} from '../validation/middleware';
import type { RfiUpdateInput, ChangeOrderUpdateInput, EquipmentUpdateInput } from '../validation/schemas';

export const constructionRootRouter = new Hono();

constructionRootRouter.patch('/rfis/:rfiId', validateRfiUpdate, async (c) => {
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

constructionRootRouter.patch('/change-orders/:coId', validateChangeOrderUpdate, async (c) => {
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

constructionRootRouter.patch('/equipment/:eqId', validateEquipmentUpdate, async (c) => {
  const eqId = c.req.param('eqId');
  const input = c.req.valid('json') as EquipmentUpdateInput;
  const updates: Record<string, unknown> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.currentProjectId !== undefined) updates.currentProjectId = input.currentProjectId;
  if (input.lastServiceDate !== undefined) updates.lastServiceDate = new Date(input.lastServiceDate);

  const [eq] = await db.update(equipment)
    .set(updates)
    .where(eq(equipment.id, eqId))
    .returning();

  if (!eq) return c.json({ error: 'Equipment not found' }, 404);
  return c.json(eq);
});