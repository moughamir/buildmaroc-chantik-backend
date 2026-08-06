import { Hono } from 'hono';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import {
  organizations,
  organizationMembers,
  organizationInvitations,
  teams,
  teamMembers,
  users,
  customRoles,
  rolePermissions,
  userRoles,
  subscriptions,
  invoices,
  apiKeys,
  webhooks,
  projects,
  workCrews,
  crewMembers,
  equipment,
} from '../db/schema';
import {
  validateOrganization,
  validateUpdateOrganization,
  validateOrganizationInvitation,
  validateInvitationAccept,
  validateTeamCreate,
  validateTeamMemberAssign,
  validateCustomRoleCreate,
  validateCustomRoleUpdate,
  validateUserRoleAssign,
  validateCheckoutSession,
  validateApiKeyCreate,
  validateWebhookRegister,
  validateProject,
  validateWorkCrew,
  validateEquipment,
} from '../validation/middleware';
import type {
  OrganizationInput,
  UpdateOrganizationInput,
  InvitationAcceptInput,
  TeamCreateInput,
  TeamMemberAssignInput,
  CustomRoleCreateInput,
  CustomRoleUpdateInput,
  UserRoleAssignInput,
  CheckoutSessionInput,
  ApiKeyCreateInput,
  WebhookRegisterInput,
  ProjectInput,
  WorkCrewInput,
  EquipmentInput,
} from '../validation/schemas';

export const organizationsRouter = new Hono();

organizationsRouter.get('/', async (c) => {
  const userId = c.req.header('x-user-id') || '';
  const result = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      billingEmail: organizations.billingEmail,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));

  return c.json(result);
});

organizationsRouter.post('/', validateOrganization, async (c) => {
  const input = c.req.valid('json') as OrganizationInput;
  const userId = c.get('userId') || '';
  const [org] = await db.insert(organizations).values({
    name: input.name,
    slug: input.slug,
    billingEmail: input.billingEmail,
  }).returning();

  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId,
    role: 'owner',
  });

  return c.json(org, 201);
});

organizationsRouter.get('/:orgId', async (c) => {
  const orgId = c.req.param('orgId');
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json(org);
});

organizationsRouter.patch('/:orgId', validateUpdateOrganization, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as UpdateOrganizationInput;
  const [org] = await db.update(organizations)
    .set(input)
    .where(eq(organizations.id, orgId))
    .returning();

  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json(org);
});

organizationsRouter.delete('/:orgId', async (c) => {
  const orgId = c.req.param('orgId');
  const [org] = await db.delete(organizations).where(eq(organizations.id, orgId)).returning();
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json({ deleted: true });
});

organizationsRouter.get('/:orgId/members', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db
    .select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      email: users.email,
      fullName: users.fullName,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId));

  return c.json(result);
});

organizationsRouter.post('/:orgId/invitations', validateOrganizationInvitation, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json');
  const token = crypto.randomUUID();
  const [invitation] = await db.insert(organizationInvitations).values({
    organizationId: orgId,
    email: input.email,
    role: input.role || 'member',
    token,
    status: 'pending',
    invitedById: input.invitedById,
    expiresAt: new Date(input.expiresAt),
  }).returning();

  return c.json(invitation, 201);
});

organizationsRouter.get('/:orgId/roles', async (c) => {
  const orgId = c.req.param('orgId');
  const roles = await db.select().from(customRoles).where(eq(customRoles.organizationId, orgId));
  return c.json(roles);
});

organizationsRouter.post('/:orgId/roles', validateCustomRoleCreate, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as CustomRoleCreateInput;
  const [role] = await db.insert(customRoles).values({
    organizationId: orgId,
    name: input.name,
  }).returning();

  return c.json(role, 201);
});

organizationsRouter.patch('/:orgId/roles/:roleId', validateCustomRoleUpdate, async (c) => {
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

organizationsRouter.post('/:orgId/users/:userId/roles', validateUserRoleAssign, async (c) => {
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

organizationsRouter.get('/:orgId/subscription', async (c) => {
  const orgId = c.req.param('orgId');
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).limit(1);
  if (!sub) return c.json({ error: 'Subscription not found' }, 404);
  return c.json(sub);
});

organizationsRouter.post('/:orgId/subscription/checkout', validateCheckoutSession, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as CheckoutSessionInput;

  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).limit(1);
  if (!subscription) return c.json({ error: 'Subscription not found' }, 404);

  return c.json({
    checkoutUrl: `https://checkout.stripe.com/session/${orgId}/${input.plan}`,
    plan: input.plan,
  }, 201);
});

organizationsRouter.get('/:orgId/invoices', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(invoices).where(eq(invoices.organizationId, orgId));
  return c.json(result);
});

organizationsRouter.get('/:orgId/api-keys', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.organizationId, orgId));
  return c.json(result);
});

organizationsRouter.post('/:orgId/api-keys', validateApiKeyCreate, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as ApiKeyCreateInput;
  const rawKey = `ck_${crypto.randomUUID().replace(/-/g, '')}`;
  const prefix = rawKey.slice(0, 10);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const [apiKey] = await db.insert(apiKeys).values({
    organizationId: orgId,
    name: input.name,
    keyHash,
    prefix,
  }).returning();

  return c.json({ ...apiKey, key: rawKey }, 201);
});

organizationsRouter.delete('/:orgId/api-keys/:keyId', async (c) => {
  const orgId = c.req.param('orgId');
  const keyId = c.req.param('keyId');
  const [deleted] = await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.organizationId, orgId))).returning();
  if (!deleted) return c.json({ error: 'API key not found' }, 404);
  return c.json({ deleted: true });
});

organizationsRouter.get('/:orgId/webhooks', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(webhooks).where(eq(webhooks.organizationId, orgId));
  return c.json(result);
});

organizationsRouter.post('/:orgId/webhooks', validateWebhookRegister, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as WebhookRegisterInput;
  const [webhook] = await db.insert(webhooks).values({
    organizationId: orgId,
    endpointUrl: input.endpointUrl,
    secret: input.secret,
    events: input.events,
  }).returning();

  return c.json(webhook, 201);
});

organizationsRouter.delete('/:orgId/webhooks/:webhookId', async (c) => {
  const orgId = c.req.param('orgId');
  const webhookId = c.req.param('webhookId');
  const [deleted] = await db.delete(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.organizationId, orgId))).returning();
  if (!deleted) return c.json({ error: 'Webhook not found' }, 404);
  return c.json({ deleted: true });
});

organizationsRouter.get('/:orgId/projects', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(projects).where(eq(projects.organizationId, orgId));
  return c.json(result);
});

organizationsRouter.post('/:orgId/projects', validateProject, async (c) => {
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

organizationsRouter.get('/:orgId/crews', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db
    .select({
      id: workCrews.id,
      name: workCrews.name,
      trade: workCrews.trade,
      teamLeadId: workCrews.teamLeadId,
      projectId: workCrews.projectId,
      createdAt: workCrews.createdAt,
      leadName: users.fullName,
    })
    .from(workCrews)
    .leftJoin(users, eq(users.id, workCrews.teamLeadId))
    .where(eq(workCrews.organizationId, orgId));

  return c.json(result);
});

organizationsRouter.post('/:orgId/crews', validateWorkCrew, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as WorkCrewInput;
  const [crew] = await db.insert(workCrews).values({
    organizationId: orgId,
    projectId: input.projectId,
    name: input.name,
    trade: input.trade,
    teamLeadId: input.teamLeadId,
  }).returning();

  return c.json(crew, 201);
});

organizationsRouter.get('/:orgId/equipment', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(equipment).where(eq(equipment.organizationId, orgId));
  return c.json(result);
});

organizationsRouter.post('/:orgId/equipment', validateEquipment, async (c) => {
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

organizationsRouter.post('/:orgId/teams', validateTeamCreate, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as TeamCreateInput;
  const [team] = await db.insert(teams).values({
    organizationId: orgId,
    name: input.name,
  }).returning();

  return c.json(team, 201);
});

organizationsRouter.post('/:orgId/teams/:teamId/members', validateTeamMemberAssign, async (c) => {
  const orgId = c.req.param('orgId');
  const teamId = c.req.param('teamId');
  const input = c.req.valid('json') as TeamMemberAssignInput;
  const [member] = await db.insert(teamMembers).values({
    teamId,
    userId: input.userId,
  }).returning();

  return c.json(member, 201);
});

organizationsRouter.delete('/:orgId/members/:userId', async (c) => {
  const orgId = c.req.param('orgId');
  const userId = c.req.param('userId');
  const [removed] = await db
    .delete(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, userId),
    ))
    .returning();

  if (!removed) return c.json({ error: 'Member not found' }, 404);
  return c.json({ removed: true });
});