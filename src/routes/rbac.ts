import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { customRoles, rolePermissions, userRoles } from '../db/schema';

export const rbacRouter = new Hono();

rbacRouter.get('/organizations/:orgId/roles', async (c) => {
  const orgId = c.req.param('orgId') as string;
  const roles = await db.select().from(customRoles).where(eq(customRoles.organizationId, orgId));
  return c.json(roles);
});

rbacRouter.post('/organizations/:orgId/roles', async (c) => {
  const orgId = c.req.param('orgId') as string;
  const body = await c.req.json<{ name: string }>();
  const [role] = await db.insert(customRoles).values({
    organizationId: orgId,
    name: body.name,
    isSystem: false,
  } as any).returning();
  return c.json(role, 201);
});

rbacRouter.post('/organizations/:orgId/roles/:roleId/permissions', async (c) => {
  const roleId = c.req.param('roleId') as string;
  const body = await c.req.json<{ resource: any; action: any }>();
  const [perm] = await db.insert(rolePermissions).values({
    roleId,
    resource: body.resource,
    action: body.action,
  } as any).returning();
  return c.json(perm, 201);
});

rbacRouter.post('/organizations/:orgId/users/:userId/roles', async (c) => {
  const orgId = c.req.param('orgId') as string;
  const userId = c.req.param('userId') as string;
  const body = await c.req.json<{ roleId: string }>();
  const [assignment] = await db.insert(userRoles).values({
    userId,
    roleId: body.roleId,
    organizationId: orgId,
  } as any).returning();
  return c.json(assignment, 201);
});
