import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { desc, sql } from 'drizzle-orm';
import {
  organizations,
  projects,
  subscriptions,
  auditLogs,
  apiKeys,
  webhooks,
  organizationMembers,
} from '../db/schema';
import {
  adminMetricsSchema,
  adminOrganizationSchema,
  adminAuditLogSchema,
  adminWebhookSchema,
} from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

// Mounted at /api/v1/admin (behind the adminGuard in src/index.ts).
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
export const adminApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

// Platform Admin: Get system metrics & overview
const adminMetricsRoute = createRoute({
  method: 'get',
  path: '/metrics',
  responses: {
    200: {
      description: 'System metrics & overview',
      content: { 'application/json': { schema: adminMetricsSchema } },
    },
  },
});

adminApp.openapi(adminMetricsRoute, async (c) => {
  const [orgCount] = await db.select({ count: sql<number>`count(*)` }).from(organizations);
  const [projCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);
  const [subCount] = await db.select({ count: sql<number>`count(*)` }).from(subscriptions);
  const [auditCount] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);

  return c.json({
    totalOrganizations: Number(orgCount?.count || 0),
    totalProjects: Number(projCount?.count || 0),
    totalSubscriptions: Number(subCount?.count || 0),
    totalAuditEvents: Number(auditCount?.count || 0),
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Platform Admin: List all tenant organizations with subscription & project count
const adminOrganizationsRoute = createRoute({
  method: 'get',
  path: '/organizations',
  responses: {
    200: {
      description: 'All tenant organizations with subscription/project/member counts',
      content: { 'application/json': { schema: z.array(adminOrganizationSchema) } },
    },
  },
});

adminApp.openapi(adminOrganizationsRoute, async (c) => {
  const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  
  const enriched = await Promise.all(orgs.map(async (org) => {
    const [sub] = await db.select().from(subscriptions).where(sql`${subscriptions.organizationId} = ${org.id}`).limit(1);
    const [proj] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(sql`${projects.organizationId} = ${org.id}`);
    const [members] = await db.select({ count: sql<number>`count(*)` }).from(organizationMembers).where(sql`${organizationMembers.organizationId} = ${org.id}`);

    return {
      ...org,
      subscription: sub || { plan: 'starter', status: 'active', maxProjects: 5 },
      projectCount: Number(proj?.count || 0),
      memberCount: Number(members?.count || 0),
    };
  }));

  return c.json(enriched);
});

// Platform Admin: Global immutable audit logs
const adminAuditLogsRoute = createRoute({
  method: 'get',
  path: '/audit-logs',
  responses: {
    200: {
      description: 'Global immutable audit logs',
      content: { 'application/json': { schema: z.array(adminAuditLogSchema) } },
    },
  },
});

adminApp.openapi(adminAuditLogsRoute, async (c) => {
  const logs = await db
    .select({
      id: auditLogs.id,
      organizationId: auditLogs.organizationId,
      orgName: organizations.name,
      userId: auditLogs.userId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(organizations, sql`${auditLogs.organizationId} = ${organizations.id}`)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return c.json(logs);
});

// Platform Admin: Global API keys & webhooks monitor
const adminWebhooksRoute = createRoute({
  method: 'get',
  path: '/webhooks',
  responses: {
    200: {
      description: 'Global API keys & webhooks monitor',
      content: { 'application/json': { schema: z.array(adminWebhookSchema) } },
    },
  },
});

adminApp.openapi(adminWebhooksRoute, async (c) => {
  const result = await db
    .select({
      id: webhooks.id,
      organizationId: webhooks.organizationId,
      orgName: organizations.name,
      endpointUrl: webhooks.endpointUrl,
      isActive: webhooks.isActive,
      events: webhooks.events,
    })
    .from(webhooks)
    .leftJoin(organizations, sql`${webhooks.organizationId} = ${organizations.id}`);

  return c.json(result);
});
