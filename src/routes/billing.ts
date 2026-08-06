import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { subscriptions, invoices } from '../db/schema';

export const billingRouter = new Hono();

// Get subscription and billing details for an organization
billingRouter.get('/organizations/:orgId/billing', async (c) => {
  const orgId = c.req.param('orgId') as string;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).limit(1);
  const orgInvoices = await db.select().from(invoices).where(eq(invoices.organizationId, orgId));

  return c.json({
    subscription: sub || { plan: 'starter', status: 'active', maxProjects: 5 },
    invoices: orgInvoices,
  });
});

// Upgrade or change subscription plan (SaaS Owner / Admin operation)
billingRouter.post('/organizations/:orgId/billing/upgrade', async (c) => {
  const orgId = c.req.param('orgId') as string;
  const body = await c.req.json<{ plan: 'starter' | 'pro' | 'enterprise' }>();
  
  const maxProjectsMap = {
    starter: 5,
    pro: 15,
    enterprise: 50,
  };

  const maxProjects = maxProjectsMap[body.plan] || 5;

  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).limit(1);

  if (existing) {
    const [updated] = await db.update(subscriptions)
      .set({ plan: body.plan, maxProjects } as any)
      .where(eq(subscriptions.organizationId, orgId))
      .returning();
    return c.json(updated);
  } else {
    const [created] = await db.insert(subscriptions).values({
      organizationId: orgId,
      plan: body.plan,
      status: 'active',
      maxProjects,
    } as any).returning();
    return c.json(created, 201);
  }
});

// Stripe Webhook handler for SaaS operations
billingRouter.post('/webhooks/stripe', async (c) => {
  const event = await c.req.json<any>();
  console.log(`[Stripe Webhook Received]: ${event.type}`);
  return c.json({ received: true });
});
