import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import {
  projects,
  zones,
  projectHealthView,
} from '../db/schema';
import { validateProject, validateZoneCreate } from '../validation/middleware';
import type { ProjectInput, ZoneCreateInput } from '../validation/schemas';

export const projectsRouter = new Hono();

projectsRouter.get('/:orgId/projects', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(projects).where(eq(projects.organizationId, orgId)).all();
  return c.json(result);
});

projectsRouter.post('/:orgId/projects', validateProject, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as ProjectInput;
  const [project] = await db.insert(projects).values({
    organizationId: orgId,
    name: input.name,
    code: input.code,
    region: input.region,
    coordinates: input.coordinates,
    status: input.status || 'planning',
  }).returning();

  return c.json(project, 201);
});

projectsRouter.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json(project);
});

projectsRouter.patch('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json');
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.code !== undefined) updates.code = input.code;
  if (input.region !== undefined) updates.region = input.region;
  if (input.coordinates !== undefined) updates.coordinates = input.coordinates;
  if (input.status !== undefined) updates.status = input.status;

  const [project] = await db.update(projects)
    .set(updates)
    .where(eq(projects.id, projectId))
    .returning();

  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json(project);
});

projectsRouter.get('/:projectId/health', async (c) => {
  const projectId = c.req.param('projectId');
  const health = await db.select().from(projectHealthView).where(eq(projectHealthView.projectId, projectId)).get();
  if (!health) return c.json({ error: 'Project not found' }, 404);
  return c.json(health);
});

projectsRouter.get('/:projectId/zones', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await db.select().from(zones).where(eq(zones.projectId, projectId)).all();
  return c.json(result);
});

projectsRouter.post('/:projectId/zones', validateZoneCreate, async (c) => {
  const projectId = c.req.param('projectId');
  const input = c.req.valid('json') as ZoneCreateInput;
  const [zone] = await db.insert(zones).values({
    projectId,
    name: input.name,
    level: input.level,
  }).returning();

  return c.json(zone, 201);
});