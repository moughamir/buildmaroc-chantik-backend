import { Hono } from 'hono';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { subscriptions, invoices, apiKeys, webhooks, organizations } from '../db/schema';
import {
  validateCheckoutSession,
  validateApiKeyCreate,
  validateWebhookRegister,
} from '../validation/middleware';
import type { CheckoutSessionInput, ApiKeyCreateInput, WebhookRegisterInput } from '../validation/schemas';

export const billingRouter = new Hono();

billingRouter.get('/:orgId/subscription', async (c) => {
  const orgId = c.req.param('orgId');
  const sub = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).get();
  if (!sub) return c.json({ error: 'Subscription not found' }, 404);
  return c.json(sub);
});

billingRouter.post('/:orgId/subscription/checkout', validateCheckoutSession, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as CheckoutSessionInput;

  const subscription = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).get();
  if (!subscription) return c.json({ error: 'Subscription not found' }, 404);

  return c.json({
    checkoutUrl: `https://checkout.stripe.com/session/${orgId}/${input.plan}`,
    plan: input.plan,
  }, 201);
});

billingRouter.get('/:orgId/invoices', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(invoices).where(eq(invoices.organizationId, orgId)).all();
  return c.json(result);
});

billingRouter.get('/:orgId/api-keys', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.organizationId, orgId)).all();
  return c.json(result);
});

billingRouter.post('/:orgId/api-keys', validateApiKeyCreate, async (c) => {
  const orgId = c.req.param('orgId');
  const input = c.req.valid('json') as ApiKeyCreateInput;
  const rawKey = `ck_${crypto.randomUUID().replace(/-/g, '')}`;
  const prefix = rawKey.slice(0, 10);
  const keyHash = rawKey;

  const [apiKey] = await db.insert(apiKeys).values({
    organizationId: orgId,
    name: input.name,
    keyHash,
    prefix,
  }).returning();

  return c.json({ ...apiKey, key: rawKey }, 201);
});

billingRouter.delete('/:orgId/api-keys/:keyId', async (c) => {
  const orgId = c.req.param('orgId');
  const keyId = c.req.param('keyId');
  const [deleted] = await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.organizationId, orgId))).returning();
  if (!deleted) return c.json({ error: 'API key not found' }, 404);
  return c.json({ deleted: true });
});

billingRouter.get('/:orgId/webhooks', async (c) => {
  const orgId = c.req.param('orgId');
  const result = await db.select().from(webhooks).where(eq(webhooks.organizationId, orgId)).all();
  return c.json(result);
});

billingRouter.post('/:orgId/webhooks', validateWebhookRegister, async (c) => {
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

billingRouter.delete('/:orgId/webhooks/:webhookId', async (c) => {
  const orgId = c.req.param('orgId');
  const webhookId = c.req.param('webhookId');
  const [deleted] = await db.delete(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.organizationId, orgId))).returning();
  if (!deleted) return c.json({ error: 'Webhook not found' }, 404);
  return c.json({ deleted: true });
});