import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import {
  rfis,
  changeOrders,
  equipment,
  blueprintSheets,
} from '../db/schema';
import {
  validateRfi,
  validateChangeOrder,
  validateEquipment,
  validateBlueprintSheet,
} from '../validation/middleware';
import type { RfiInput, ChangeOrderInput, EquipmentInput, BlueprintSheetInput } from '../validation/schemas';

export const constructionRouter = new Hono();

constructionRouter.get('/:projectId/rfis', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(rfis).where(eq(rfis.projectId, projectId)).all();
  return c.json(result);
});

constructionRouter.post('/:projectId/rfis', validateRfi, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as RfiInput;
  const maxRfi = await db.select({ maxNum: rfis.rfiNumber }).from(rfis).where(eq(rfis.projectId, projectId)).orderBy(rfis.rfiNumber, { direction: 'desc' }).limit(1).get();
  const nextNumber = maxRfi ? maxRfi.maxNum + 1 : 1;

  const [rfi] = await db.insert(rfis).values({
    projectId,
    rfiNumber: nextNumber,
    title: input.title,
    question: input.question,
    answer: input.answer,
    status: input.status || 'draft',
    createdById: input.createdById,
    assignedToId: input.assignedToId,
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
  }).returning();

  return c.json(rfi, 201);
});

constructionRouter.get('/:projectId/change-orders', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(changeOrders).where(eq(changeOrders.projectId, projectId)).all();
  return c.json(result);
});

constructionRouter.post('/:projectId/change-orders', validateChangeOrder, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as ChangeOrderInput;
  const [co] = await db.insert(changeOrders).values({
    projectId,
    coNumber: input.coNumber,
    title: input.title,
    description: input.description,
    costImpactCents: input.costImpactCents,
    scheduleImpactDays: input.scheduleImpactDays,
    status: input.status || 'pending',
    requestedById: input.requestedById,
    approvedById: input.approvedById,
  }).returning();

  return c.json(co, 201);
});

constructionRouter.get('/:orgId/equipment', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(equipment).where(eq(equipment.organizationId, orgId)).all();
  return c.json(result);
});

constructionRouter.post('/:orgId/equipment', validateEquipment, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as EquipmentInput;
  const [eq] = await db.insert(equipment).values({
    organizationId: orgId,
    currentProjectId: input.currentProjectId,
    name: input.name,
    serialNumber: input.serialNumber,
    category: input.category,
    status: input.status || 'available',
    lastServiceDate: input.lastServiceDate ? new Date(input.lastServiceDate) : undefined,
  }).returning();

  return c.json(eq, 201);
});

constructionRouter.get('/:projectId/blueprints', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(blueprintSheets).where(eq(blueprintSheets.projectId, projectId)).all();
  return c.json(result);
});

constructionRouter.post('/:projectId/blueprints', validateBlueprintSheet, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as BlueprintSheetInput;
  const [sheet] = await db.insert(blueprintSheets).values({
    projectId,
    sheetNumber: input.sheetNumber,
    title: input.title,
    version: input.version,
    storagePath: input.storagePath,
    uploadedById: input.uploadedById,
  }).returning();

  return c.json(sheet, 201);
});