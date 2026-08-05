import { Hono } from 'hono';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { organizationInvitations, organizationMembers } from '../db/schema';
import { validateInvitationAccept } from '../validation/middleware';
import type { InvitationAcceptInput } from '../validation/schemas';

export const invitationsRouter = new Hono();

invitationsRouter.post('/accept', validateInvitationAccept, async (c) => {
  const input = c.req.valid('json') as InvitationAcceptInput;
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
  });

  return c.json({ accepted: true });
});