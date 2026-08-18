import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { organizationInvitations, organizationMembers } from '../db/schema';
import { invitationAcceptSchema } from '../validation/schemas';
import type { InvitationAcceptInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';
import { isDevBypass } from '../middleware/tenant';

export const invitationsApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const invitationAcceptResponseSchema = z.object({
  accepted: z.boolean(),
});

const invitationAcceptRoute = createRoute({
  method: 'post',
  path: '/accept',
  tags: ['invitations'],
  request: {
    body: { content: { 'application/json': { schema: invitationAcceptSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Invitation accepted',
      content: { 'application/json': { schema: invitationAcceptResponseSchema } },
    },
    400: { description: 'Invalid or expired invitation' },
    401: { description: 'Authentication required' },
    403: { description: 'Forbidden' },
  },
});

invitationsApp.openapi(invitationAcceptRoute, async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);

  const input = c.req.valid('json') as InvitationAcceptInput;
  if (userId !== input.userId && !isDevBypass(c)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const [invitation] = await db
    .update(organizationInvitations)
    .set({ status: 'accepted' })
    .where(eq(organizationInvitations.token, input.token))
    .returning();

  if (!invitation) return c.json({ error: 'Invalid or expired invitation' }, 400);

  await db.insert(organizationMembers).values({
    organizationId: invitation.organizationId,
    userId: input.userId,
    role: invitation.role,
  }).onConflictDoNothing();

  return c.json({ accepted: true });
});
