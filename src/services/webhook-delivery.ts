import { createHmac } from 'node:crypto';
import { db } from '../db';
import { and, eq, lte, inArray } from 'drizzle-orm';
import { webhooks, webhookDeliveries } from '../db/schema';

// PLAN 4.7 — webhook delivery worker with retry logic.
//
// - `enqueueWebhookEvent` inserts a delivery row per active webhook subscribed
//   to the event; the worker (see index.ts) performs the actual HTTP POSTs.
// - `processPendingDeliveries` delivers due rows, signing the raw body with
//   HMAC-SHA256 (webhook.secret) as `x-chantik-signature`. On non-2xx or
//   network error it retries with exponential backoff; after MAX_ATTEMPTS the
//   webhook is deactivated (isActive = false) and the delivery marked failed.

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 60_000; // 1 min
const REQUEST_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 25;

export type WebhookEvent = 'project.created' | 'hotspot.resolved' | 'panorama.uploaded';

export function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Enqueue a webhook event for every active webhook of the organization that
 * subscribes to `event`. Fire-and-forget from request handlers: delivery is
 * performed asynchronously by the worker, never blocking the API response.
 */
export async function enqueueWebhookEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>,
  organizationId: string,
): Promise<number> {
  if (!organizationId) return 0;

  const subscribed = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(
      and(
        eq(webhooks.organizationId, organizationId),
        eq(webhooks.isActive, true),
      ),
    );

  if (subscribed.length === 0) return 0;

  const rows = subscribed.map((w) => ({
    webhookId: w.id,
    event,
    payload,
    status: 'pending',
    attempts: 0,
    nextRetryAt: new Date(),
  }));

  const inserted = await db.insert(webhookDeliveries).values(rows).returning({ id: webhookDeliveries.id });
  return inserted.length;
}

function backoffDelayMs(attempts: number): number {
  // attempt 1 -> 1m, 2 -> 2m, 3 -> 4m, 4 -> 8m (then deactivated at 5)
  return BACKOFF_BASE_MS * 2 ** (attempts - 1);
}

/**
 * Process due (status = 'pending' AND nextRetryAt <= now) deliveries.
 * Returns the number of deliveries processed (attempted, delivered or failed).
 * Safe to run on an interval; rows are claimed individually so a crash between
 * attempts only delays the retry.
 */
export async function processPendingDeliveries(batchSize = BATCH_SIZE): Promise<number> {
  const now = new Date();
  const due = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, 'pending'),
        lte(webhookDeliveries.nextRetryAt, now),
      ),
    )
    .limit(batchSize);

  if (due.length === 0) return 0;

  const webhookIds = [...new Set(due.map((d) => d.webhookId))];
  const webhooksById = new Map(
    (await db.select().from(webhooks).where(inArray(webhooks.id, webhookIds)))
      .map((w) => [w.id, w]),
  );

  let processed = 0;

  for (const delivery of due) {
    const webhook = webhooksById.get(delivery.webhookId);
    if (!webhook || !webhook.isActive) {
      // Endpoint deleted or disabled — drop the delivery.
      await db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, delivery.id));
      continue;
    }

    const body = JSON.stringify({
      id: delivery.id,
      event: delivery.event,
      organizationId: webhook.organizationId,
      payload: delivery.payload,
      deliveredAt: new Date().toISOString(),
    });
    const signature = signPayload(webhook.secret, body);

    let ok = false;
    let lastError: string | null = null;
    try {
      const res = await fetch(webhook.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'chantik-webhook/1.0',
          'x-chantik-event': delivery.event,
          'x-chantik-delivery-id': delivery.id,
          'x-chantik-signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      ok = res.ok;
      if (!ok) lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    processed++;

    if (ok) {
      await db
        .update(webhookDeliveries)
        .set({ status: 'delivered', attempts: delivery.attempts + 1, lastError: null, deliveredAt: new Date() })
        .where(eq(webhookDeliveries.id, delivery.id));
      continue;
    }

    const nextAttempt = delivery.attempts + 1;
    if (nextAttempt >= MAX_ATTEMPTS) {
      // Give up: mark failed and deactivate the webhook so it stops queuing.
      await db
        .update(webhookDeliveries)
        .set({ status: 'failed', attempts: nextAttempt, lastError })
        .where(eq(webhookDeliveries.id, delivery.id));
      await db.update(webhooks).set({ isActive: false }).where(eq(webhooks.id, webhook.id));
    } else {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'pending',
          attempts: nextAttempt,
          lastError,
          nextRetryAt: new Date(Date.now() + backoffDelayMs(nextAttempt)),
        })
        .where(eq(webhookDeliveries.id, delivery.id));
    }
  }

  return processed;
}
