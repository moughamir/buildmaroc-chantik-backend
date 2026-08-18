import { pgTable, uuid, text, timestamp, varchar, integer, jsonb, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { subscriptionPlanEnum } from './enums';
import { webhookEventEnum } from './enums';
import { organizations } from './organizations';

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  plan: subscriptionPlanEnum('plan').notNull().default('starter'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  maxProjects: integer('max_projects').default(5), 
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  externalId: varchar('external_id', { length: 100 }).notNull().unique(), 
  amountDue: integer('amount_due').notNull(), 
  amountPaid: integer('amount_paid').notNull(), 
  status: varchar('status', { length: 50 }).notNull(),
  hostedInvoiceUrl: text('hosted_invoice_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  keyHash: text('key_hash').notNull().unique(), 
  prefix: varchar('prefix', { length: 10 }).notNull(), 
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  endpointUrl: text('endpoint_url').notNull(),
  secret: text('secret').notNull(), 
  isActive: boolean('is_active').default(true).notNull(),
  events: webhookEventEnum('events').array().notNull(), 
}, (t) => [
  index('webhook_org_idx').on(t.organizationId),
]);

// PLAN 4.7 — delivery ledger for outbound webhook events (per webhook per event).
// One row per (webhook, event) enqueue; the delivery worker advances attempts
// with exponential backoff until `delivered` or `failed` (then deactivates the webhook).
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: uuid('webhook_id').references(() => webhooks.id, { onDelete: 'cascade' }).notNull(),
  event: webhookEventEnum('event').notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | delivered | failed
  attempts: integer('attempts').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }).notNull().defaultNow(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
}, (t) => [
  index('webhook_delivery_webhook_idx').on(t.webhookId),
  index('webhook_delivery_due_idx').on(t.status, t.nextRetryAt),
]);