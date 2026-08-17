import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
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
  auditLogs,
} from '../db/schema';
import {
  organizationSchema,
  updateOrganizationSchema,
  organizationInvitationSchema,
  customRoleCreateSchema,
  customRoleUpdateSchema,
  userRoleAssignSchema,
  checkoutSessionSchema,
  apiKeyCreateSchema,
  webhookRegisterSchema,
  projectSchema,
  workCrewSchema,
  equipmentSchema,
  teamCreateSchema,
  teamMemberAssignSchema,
  organizationSelectSchema,
  organizationListSelectSchema,
  orgMemberWithUserSchema,
  organizationInvitationSelectSchema,
  customRoleSelectSchema,
  userRoleSelectSchema,
  subscriptionSelectSchema,
  invoiceSelectSchema,
  apiKeyListSelectSchema,
  apiKeyWithKeySchema,
  webhookSelectSchema,
  projectSelectSchema,
  crewWithLeadSchema,
  workCrewSelectSchema,
  equipmentSelectSchema,
  teamSelectSchema,
  teamMemberSelectSchema,
  auditLogSelectSchema,
  deletedResponseSchema,
  removedResponseSchema,
  checkoutResponseSchema,
  exportDataSchema,
} from '../validation/schemas';
import type {
  OrganizationInput,
  UpdateOrganizationInput,
  OrganizationInvitationInput,
  CustomRoleCreateInput,
  CustomRoleUpdateInput,
  UserRoleAssignInput,
  CheckoutSessionInput,
  ApiKeyCreateInput,
  WebhookRegisterInput,
  ProjectInput,
  WorkCrewInput,
  EquipmentInput,
  TeamCreateInput,
  TeamMemberAssignInput,
} from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';
import { requireOrgMembership, requireOrgRole } from '../middleware/tenant';

// Mounted at /api/v1/organizations.
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
// Org-scoping: identity comes from the session middleware (c.get('userId'));
// every org-scoped route takes its `:orgId` from the path (existing contract).
export const organizationsApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const organizationsListRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['organizations'],
  responses: {
    200: {
      description: 'Organizations the authenticated user belongs to',
      content: { 'application/json': { schema: z.array(organizationListSelectSchema) } },
    },
  },
});

organizationsApp.openapi(organizationsListRoute, async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json([]);
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

const organizationsCreateRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['organizations'],
  request: {
    body: { content: { 'application/json': { schema: organizationSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Organization created',
      content: { 'application/json': { schema: organizationSelectSchema } },
    },
  },
});

organizationsApp.openapi(organizationsCreateRoute, async (c) => {
  const input = c.req.valid('json') as OrganizationInput;
  const userId = c.get('userId') || '';
  const [org] = await db.insert(organizations).values({
    name: input.name,
    slug: input.slug,
    billingEmail: input.billingEmail,
  } as any).returning();

  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId,
    role: 'owner',
  } as any);

  return c.json(org, 201);
});

const organizationGetRoute = createRoute({
  method: 'get',
  path: '/{orgId}',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Organization detail',
      content: { 'application/json': { schema: organizationSelectSchema } },
    },
    404: {
      description: 'Organization not found',
    },
  },
});

organizationsApp.openapi(organizationGetRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json(org);
});

const organizationPatchRoute = createRoute({
  method: 'patch',
  path: '/{orgId}',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateOrganizationSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Organization updated',
      content: { 'application/json': { schema: organizationSelectSchema } },
    },
    404: {
      description: 'Organization not found',
    },
  },
});

organizationsApp.openapi(organizationPatchRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const input = c.req.valid('json') as UpdateOrganizationInput;
  const [org] = await db.update(organizations)
    .set(input)
    .where(eq(organizations.id, orgId))
    .returning();

  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json(org);
});

const organizationDeleteRoute = createRoute({
  method: 'delete',
  path: '/{orgId}',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Organization deleted',
      content: { 'application/json': { schema: deletedResponseSchema } },
    },
    404: {
      description: 'Organization not found',
    },
  },
});

organizationsApp.openapi(organizationDeleteRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const [org] = await db.delete(organizations).where(eq(organizations.id, orgId)).returning();
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  return c.json({ deleted: true });
});

const organizationMembersListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/members',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Members of the organization with user email/name',
      content: { 'application/json': { schema: z.array(orgMemberWithUserSchema) } },
    },
  },
});

organizationsApp.openapi(organizationMembersListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const result = await db
    .select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      createdAt: organizationMembers.createdAt,
      email: users.email,
      name: users.name,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId));

  return c.json(result);
});

const organizationInvitationCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/invitations',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: organizationInvitationSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Invitation created',
      content: { 'application/json': { schema: organizationInvitationSelectSchema } },
    },
  },
});

organizationsApp.openapi(organizationInvitationCreateRoute, async (c) => {
  const orgId = c.req.param('orgId') as string;
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const input = c.req.valid('json') as OrganizationInvitationInput;
  const token = crypto.randomUUID();
  const [invitation] = await db.insert(organizationInvitations).values({
    organizationId: orgId,
    email: input.email,
    role: input.role || 'member',
    token,
    status: 'pending',
    invitedById: c.get('userId') || null,
    expiresAt: new Date(input.expiresAt),
  } as any).returning();

  return c.json(invitation, 201);
});

const customRolesListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/roles',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Custom roles for the organization',
      content: { 'application/json': { schema: z.array(customRoleSelectSchema) } },
    },
  },
});

organizationsApp.openapi(customRolesListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const roles = await db.select().from(customRoles).where(eq(customRoles.organizationId, orgId));
  return c.json(roles);
});

const customRoleCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/roles',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: customRoleCreateSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Custom role created',
      content: { 'application/json': { schema: customRoleSelectSchema } },
    },
  },
});

organizationsApp.openapi(customRoleCreateRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const input = c.req.valid('json') as CustomRoleCreateInput;
  const [role] = await db.insert(customRoles).values({
    organizationId: orgId,
    name: input.name,
  }).returning();

  return c.json(role, 201);
});

const customRolePatchRoute = createRoute({
  method: 'patch',
  path: '/{orgId}/roles/{roleId}',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid(), roleId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: customRoleUpdateSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Custom role updated',
      content: { 'application/json': { schema: customRoleSelectSchema } },
    },
    404: {
      description: 'Role not found',
    },
  },
});

organizationsApp.openapi(customRolePatchRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
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

const userRoleAssignRoute = createRoute({
  method: 'post',
  path: '/{orgId}/users/{userId}/roles',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid(), userId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: userRoleAssignSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Role assigned to user',
      content: { 'application/json': { schema: userRoleSelectSchema } },
    },
  },
});

organizationsApp.openapi(userRoleAssignRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const userId = c.req.param('userId');
  const input = c.req.valid('json') as UserRoleAssignInput;
  const [assignment] = await db.insert(userRoles).values({
    userId,
    roleId: input.roleId,
    organizationId: orgId,
  }).returning();

  return c.json(assignment, 201);
});

const subscriptionGetRoute = createRoute({
  method: 'get',
  path: '/{orgId}/subscription',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Organization subscription',
      content: { 'application/json': { schema: subscriptionSelectSchema } },
    },
    404: {
      description: 'Subscription not found',
    },
  },
});

organizationsApp.openapi(subscriptionGetRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).limit(1);
  if (!sub) return c.json({ error: 'Subscription not found' }, 404);
  return c.json(sub);
});

const checkoutCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/subscription/checkout',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: checkoutSessionSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Mock Stripe checkout session',
      content: { 'application/json': { schema: checkoutResponseSchema } },
    },
    404: {
      description: 'Subscription not found',
    },
  },
});

organizationsApp.openapi(checkoutCreateRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const input = c.req.valid('json') as CheckoutSessionInput;

  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).limit(1);
  if (!subscription) return c.json({ error: 'Subscription not found' }, 404);

  return c.json({
    checkoutUrl: `https://checkout.stripe.com/session/${orgId}/${input.plan}`,
    plan: input.plan,
  }, 201);
});

const invoicesListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/invoices',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Organization invoices',
      content: { 'application/json': { schema: z.array(invoiceSelectSchema) } },
    },
  },
});

organizationsApp.openapi(invoicesListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const result = await db.select().from(invoices).where(eq(invoices.organizationId, orgId));
  return c.json(result);
});

const apiKeysListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/api-keys',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Organization API keys (no secrets)',
      content: { 'application/json': { schema: z.array(apiKeyListSelectSchema) } },
    },
  },
});

organizationsApp.openapi(apiKeysListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const result = await db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.organizationId, orgId));
  return c.json(result);
});

const apiKeyCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/api-keys',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: apiKeyCreateSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'API key created (raw key returned once)',
      content: { 'application/json': { schema: apiKeyWithKeySchema } },
    },
  },
});

organizationsApp.openapi(apiKeyCreateRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
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

const apiKeyDeleteRoute = createRoute({
  method: 'delete',
  path: '/{orgId}/api-keys/{keyId}',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid(), keyId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'API key deleted',
      content: { 'application/json': { schema: deletedResponseSchema } },
    },
    404: {
      description: 'API key not found',
    },
  },
});

organizationsApp.openapi(apiKeyDeleteRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const keyId = c.req.param('keyId');
  const [deleted] = await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.organizationId, orgId))).returning();
  if (!deleted) return c.json({ error: 'API key not found' }, 404);
  return c.json({ deleted: true });
});

const webhooksListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/webhooks',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Organization webhooks',
      content: { 'application/json': { schema: z.array(webhookSelectSchema) } },
    },
  },
});

organizationsApp.openapi(webhooksListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const result = await db.select().from(webhooks).where(eq(webhooks.organizationId, orgId));
  return c.json(result);
});

const webhookCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/webhooks',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: webhookRegisterSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Webhook registered',
      content: { 'application/json': { schema: webhookSelectSchema } },
    },
  },
});

organizationsApp.openapi(webhookCreateRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const input = c.req.valid('json') as WebhookRegisterInput;
  const [webhook] = await db.insert(webhooks).values({
    organizationId: orgId,
    endpointUrl: input.endpointUrl,
    secret: input.secret,
    events: input.events,
  }).returning();

  return c.json(webhook, 201);
});

const webhookDeleteRoute = createRoute({
  method: 'delete',
  path: '/{orgId}/webhooks/{webhookId}',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid(), webhookId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Webhook deleted',
      content: { 'application/json': { schema: deletedResponseSchema } },
    },
    404: {
      description: 'Webhook not found',
    },
  },
});

organizationsApp.openapi(webhookDeleteRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const webhookId = c.req.param('webhookId');
  const [deleted] = await db.delete(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.organizationId, orgId))).returning();
  if (!deleted) return c.json({ error: 'Webhook not found' }, 404);
  return c.json({ deleted: true });
});

const orgProjectsListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/projects',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Projects for an explicit organization',
      content: { 'application/json': { schema: z.array(projectSelectSchema) } },
    },
  },
});

organizationsApp.openapi(orgProjectsListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const result = await db.select().from(projects).where(eq(projects.organizationId, orgId));
  return c.json(result);
});

const orgProjectCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/projects',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: projectSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Project created',
      content: { 'application/json': { schema: projectSelectSchema } },
    },
  },
});

organizationsApp.openapi(orgProjectCreateRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
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

const orgCrewsListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/crews',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Crews for the organization with team lead name',
      content: { 'application/json': { schema: z.array(crewWithLeadSchema) } },
    },
  },
});

organizationsApp.openapi(orgCrewsListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const result = await db
    .select({
      id: workCrews.id,
      name: workCrews.name,
      trade: workCrews.trade,
      teamLeadId: workCrews.teamLeadId,
      projectId: workCrews.projectId,
      createdAt: workCrews.createdAt,
      leadName: users.name,
    })
    .from(workCrews)
    .leftJoin(users, eq(users.id, workCrews.teamLeadId))
    .where(eq(workCrews.organizationId, orgId));

  return c.json(result);
});

const orgCrewCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/crews',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: workCrewSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Crew created',
      content: { 'application/json': { schema: workCrewSelectSchema } },
    },
  },
});

organizationsApp.openapi(orgCrewCreateRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
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

const orgEquipmentListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/equipment',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Equipment for the organization',
      content: { 'application/json': { schema: z.array(equipmentSelectSchema) } },
    },
  },
});

organizationsApp.openapi(orgEquipmentListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const result = await db.select().from(equipment).where(eq(equipment.organizationId, orgId));
  return c.json(result);
});

const orgEquipmentCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/equipment',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: equipmentSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Equipment created',
      content: { 'application/json': { schema: equipmentSelectSchema } },
    },
  },
});

organizationsApp.openapi(orgEquipmentCreateRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
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

const teamCreateRoute = createRoute({
  method: 'post',
  path: '/{orgId}/teams',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: teamCreateSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Team created',
      content: { 'application/json': { schema: teamSelectSchema } },
    },
  },
});

organizationsApp.openapi(teamCreateRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const input = c.req.valid('json') as TeamCreateInput;
  const [team] = await db.insert(teams).values({
    organizationId: orgId,
    name: input.name,
  }).returning();

  return c.json(team, 201);
});

const teamMemberAssignRoute = createRoute({
  method: 'post',
  path: '/{orgId}/teams/{teamId}/members',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid(), teamId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: teamMemberAssignSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Team member assigned',
      content: { 'application/json': { schema: teamMemberSelectSchema } },
    },
  },
});

organizationsApp.openapi(teamMemberAssignRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
  const teamId = c.req.param('teamId');
  const input = c.req.valid('json') as TeamMemberAssignInput;
  const [member] = await db.insert(teamMembers).values({
    teamId,
    userId: input.userId,
  }).returning();

  return c.json(member, 201);
});

const organizationMemberDeleteRoute = createRoute({
  method: 'delete',
  path: '/{orgId}/members/{userId}',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid(), userId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Member removed',
      content: { 'application/json': { schema: removedResponseSchema } },
    },
    404: {
      description: 'Member not found',
    },
  },
});

organizationsApp.openapi(organizationMemberDeleteRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgRole(c, orgId, 'admin');
  if (denied) return denied;
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

const orgAuditLogsListRoute = createRoute({
  method: 'get',
  path: '/{orgId}/audit-logs',
  tags: ['organizations'],
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Recent audit logs for the organization',
      content: { 'application/json': { schema: z.array(auditLogSelectSchema) } },
    },
  },
});

organizationsApp.openapi(orgAuditLogsListRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const result = await db.select().from(auditLogs).where(eq(auditLogs.organizationId, orgId)).limit(100);
  return c.json(result);
});

const orgExportRoute = createRoute({
  method: 'get',
  path: '/{orgId}/export',
  tags: ['organizations'],
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    query: z.object({ format: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'Organization export (JSON payload; the csv=format branch returns a raw CSV response)',
    },
  },
});

organizationsApp.openapi(orgExportRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;
  const format = c.req.query('format') || 'json';

  const orgProjects = await db.select().from(projects).where(eq(projects.organizationId, orgId));
  const orgMembers = await db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
  const orgInvoices = await db.select().from(invoices).where(eq(invoices.organizationId, orgId));

  const exportData = {
    exportedAt: new Date().toISOString(),
    organizationId: orgId,
    projects: orgProjects,
    members: orgMembers,
    invoices: orgInvoices,
  };

  if (format === 'csv') {
    const headers = ['id', 'name', 'code', 'region', 'status', 'created_at'];
    const rows = orgProjects.map((p: any) => [p.id, JSON.stringify(p.name), p.code, p.region, p.status, p.createdAt].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="chantik-export-${orgId}.csv"`,
      },
    });
  }

  return c.json(exportData);
});
