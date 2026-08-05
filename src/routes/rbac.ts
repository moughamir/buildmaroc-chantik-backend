import { Hono } from 'hono';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { customRoles, rolePermissions, userRoles, organizations } from '../db/schema';
import {
  validateCustomRoleCreate,
  validateCustomRoleUpdate,
  validateUserRoleAssign,
} from '../validation/middleware';
import type { CustomRoleCreateInput, CustomRoleUpdateInput, UserRoleAssignInput } from '../validation/schemas';

export const rbacRouter = new Hono();

rbacRouter.get('/:orgId/roles', async (c) => {
  const orgId = c.req.param('orgId');
  const roles = await db.select().from(customRoles).where(eq(customRoles.organizationId, orgId)).all();
  return c.json(roles);
});

rbacRouter.post('/:orgId/roles', validateCustomRoleCreate, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as CustomRoleCreateInput;
  const [role] = await db.insert(customRoles).values({
    organizationId: orgId,
    name: input.name,
  }).returning();

  return c.json(role, 201);
});

rbacRouter.patch('/:orgId/roles/:roleId', validateCustomRoleUpdate, async (c) => {
  const orgId = c.req.param('orgId');
  const roleId = c.req.param('roleId');
  const input = c.req.valid('json') as CustomRoleUpdateInput;

  if (input.permissions) {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    const permissionValues = input.permissions.map((p) => ({
      roleId,
      resource: p.resource,
      action: p.action,
    }));
    await db.insert(rolePermissions).values(permissionValues);
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;

  const [role] = await db.update(customRoles)
    .set(updates)
    .where(and(eq(customRoles.id, roleId), eq(customRoles.organizationId, orgId)))
    .returning();

  if (!role) return c.json({ error: 'Role not found' }, 404);
  return c.json(role);
});

rbacRouter.post('/:orgId/users/:userId/roles', validateUserRoleAssign, async (c) => {
  const orgId = c.req.param('orgId');
  const userId = c.req.param('userId');
  const input = c.req.valid('json') as UserRoleAssignInput;
  const [assignment] = await db.insert(userRoles).values({
    userId,
    roleId: input.roleId,
    organizationId: orgId,
  }).returning();

  return c.json(assignment, 201);
});